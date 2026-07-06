import logging
import os
import re
from collections.abc import Callable

import sqlalchemy as sa
from flask import current_app, request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from marshmallow import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from superset.connectors.sqla.models import DatasourceKind, SqlaTable
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.daos.datasource import DatasourceDAO
from superset.daos.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.exceptions import QueryObjectValidationError, SupersetSecurityException
from superset.extensions import event_logger
from superset.geoset_map.schemas import (
    GeoSetLayerV1Schema,
    GeoSetLayerV2Schema,
    GeoSetLayerV3Schema,
    GeoSetLayerV4Schema,
    GeoSetLayerV5Schema,
    MapboxApiKeySchema,
)
from superset.utils.core import DatasourceType
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

logger = logging.getLogger(__name__)

VERSION_PATTERN = re.compile(r"^v(\d+)$")


def parse_version_number(version: str) -> int | None:
    """Extract the numeric version from a version string like 'v1', 'v2', etc.

    Returns None if the version string doesn't match the expected format.
    """
    match = VERSION_PATTERN.match(version)
    return int(match.group(1)) if match else None


def is_valid_tile_coordinate(z: int, x: int, y: int) -> bool:
    if z < 0 or z > 30:
        return False

    tile_count = 2**z
    return 0 <= x < tile_count and 0 <= y < tile_count


def _validate_identifier(identifier: str) -> str:
    """Validate a simple SQL identifier before it is interpolated into SQL."""
    if not identifier or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", identifier):
        raise ValueError(f"Invalid SQL identifier: {identifier}")

    return identifier


def _quote_identifier(identifier: str, quote: Callable[[str], str]) -> str:
    """Quote a SQL identifier component after validating it."""
    parts = identifier.split(".")
    if not parts or any(not part for part in parts):
        raise ValueError(f"Invalid SQL identifier: {identifier}")

    return ".".join(quote(_validate_identifier(part)) for part in parts)


def _sanitize_rls_filter(filter_clause: str) -> str:
    """Reject obvious SQL injection attempts in row-level filter fragments."""
    if not filter_clause or any(
        token in filter_clause for token in (";", "--", "/*", "*/")
    ):
        raise ValueError(f"Invalid row-level filter: {filter_clause}")

    return filter_clause


def _normalize_cte_fragment(cte: str) -> str:
    cte = cte.strip().rstrip(";")
    return re.sub(r"^WITH\s+", "", cte, flags=re.IGNORECASE)


def quote_physical_table_name(datasource: SqlaTable) -> str:
    quote = datasource.database.quote_identifier
    table_name = _quote_identifier(datasource.table_name, quote)

    if datasource.schema:
        return f"{_quote_identifier(datasource.schema, quote)}.{table_name}"

    return table_name


def get_mvt_source_sql(
    datasource: SqlaTable,
    template_processor: object,
    engine: sa.engine.Engine,
) -> tuple[str, str | None]:
    if datasource.kind != DatasourceKind.VIRTUAL:
        return quote_physical_table_name(datasource), None

    from_clause, cte = datasource.get_from_clause(template_processor)
    source_sql = str(
        from_clause.compile(
            dialect=engine.dialect,
            compile_kwargs={"literal_binds": True},
        )
    )
    return source_sql, cte


def build_mvt_tile_sql(
    datasource: SqlaTable,
    source_sql: str,
    geometry_column: str,
    rls_filters: list[str],
    cte: str | None = None,
) -> str:
    quote = datasource.database.quote_identifier
    geom_expr = f"{_quote_identifier(geometry_column, quote)}::geometry"
    projected_geom_expr = (
        "ST_Transform("
        f"CASE WHEN ST_SRID({geom_expr}) = 0 "
        f"THEN ST_SetSRID({geom_expr}, 4326) "
        f"ELSE {geom_expr} END, "
        "3857)"
    )
    where_clauses = [
        f"{geom_expr} IS NOT NULL",
        f"ST_Intersects({projected_geom_expr}, bounds.geom)",
    ]

    for filter_clause in rls_filters:
        where_clauses.append(f"({_sanitize_rls_filter(filter_clause)})")

    with_clause = f"{_normalize_cte_fragment(cte)},\nbounds" if cte else "bounds"

    return f"""  # noqa: S608
WITH {with_clause} AS (
    SELECT ST_TileEnvelope(:z, :x, :y) AS geom
),
mvtgeom AS (
    SELECT
        ST_AsMVTGeom(
            {projected_geom_expr},
            bounds.geom,
            4096,
            256,
            true
        ) AS geom
    FROM {source_sql}, bounds
    WHERE {" AND ".join(where_clauses)}
)
SELECT ST_AsMVT(mvtgeom, 'default', 4096, 'geom') AS tile
FROM mvtgeom
"""


class GeoSetMapRestApi(BaseSupersetApi):
    mapbox_api_key_schema = MapboxApiKeySchema()
    # when new GeoSetLayer schemas are created they need to be added to this mapping
    geoset_layer_schemas = {
        "v1": GeoSetLayerV1Schema(),
        "v2": GeoSetLayerV2Schema(),
        "v3": GeoSetLayerV3Schema(),
        "v4": GeoSetLayerV4Schema(),
        "v5": GeoSetLayerV5Schema(),
    }
    # single-step upgrade functions: each handles vN → vN+1
    # multi-version jumps (e.g. v1→v3) are auto-chained by convert_schema
    schema_upgrade_steps = {
        ("v1", "v2"): GeoSetLayerV2Schema.upgrade_from_previous_version,
        ("v2", "v3"): GeoSetLayerV3Schema.upgrade_from_previous_version,
        ("v3", "v4"): GeoSetLayerV4Schema.upgrade_from_previous_version,
        ("v4", "v5"): GeoSetLayerV5Schema.upgrade_from_previous_version,
    }

    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    class_permission_name = "GeoSetMap"
    resource_name = "geoset_map"
    openapi_spec_tag = "GeoSet Map"
    openapi_spec_component_schemas = (
        GeoSetLayerV1Schema,
        GeoSetLayerV2Schema,
        GeoSetLayerV3Schema,
        GeoSetLayerV4Schema,
        GeoSetLayerV5Schema,
        MapboxApiKeySchema,
    )

    @expose("/mvt/<int:datasource_id>/<int:z>/<int:x>/<int:y>", methods=("GET",))
    @permission_name("read")
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.mvt_tile",
        log_to_statsd=True,
    )
    def mvt_tile(self, datasource_id: int, z: int, x: int, y: int) -> Response:
        """
        Generate a Mapbox Vector Tile from a Superset PostGIS dataset.
        ---
        get:
          summary: Generate an MVT tile for a GeoSet layer
          parameters:
            - in: path
              name: datasource_id
              schema:
                type: integer
              required: true
              description: Superset dataset id
            - in: path
              name: z
              schema:
                type: integer
              required: true
              description: Tile zoom
            - in: path
              name: x
              schema:
                type: integer
              required: true
              description: Tile x coordinate
            - in: path
              name: y
              schema:
                type: integer
              required: true
              description: Tile y coordinate
            - in: query
              name: geometry_column
              schema:
                type: string
              required: true
              description: Geometry/geography column to tile
          responses:
            200:
              description: A Mapbox Vector Tile
              content:
                application/x-protobuf:
                  schema:
                    type: string
                    format: binary
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        geometry_column = request.args.get("geometry_column")
        if not geometry_column:
            return self.response_400(message="geometry_column is required")

        if not is_valid_tile_coordinate(z, x, y):
            return self.response_400(message="Invalid tile coordinate")

        try:
            datasource = DatasourceDAO.get_datasource(
                DatasourceType.TABLE,
                datasource_id,
            )
        except (DatasourceNotFound, DatasourceTypeNotSupportedError):
            return self.response_404()

        if not isinstance(datasource, SqlaTable):
            return self.response_400(message="Datasource must be a SQL table dataset")

        try:
            datasource.raise_for_access()
        except SupersetSecurityException as ex:
            return self.response(403, message=ex.message)

        if datasource.database.backend != "postgresql":
            return self.response_400(
                message="MVT tiles currently require a PostgreSQL/PostGIS dataset"
            )

        valid_columns = {column.column_name for column in datasource.columns}
        if geometry_column not in valid_columns:
            return self.response_400(message="Unknown geometry_column")

        sql = ""
        try:
            with datasource.database.get_sqla_engine(
                catalog=datasource.catalog,
                schema=datasource.schema,
            ) as engine:
                template_processor = datasource.get_template_processor()
                source_sql, cte = get_mvt_source_sql(
                    datasource,
                    template_processor,
                    engine,
                )
                rls_filters = [
                    str(
                        filter_clause.compile(
                            dialect=engine.dialect,
                            compile_kwargs={"literal_binds": True},
                        )
                    )
                    for filter_clause in datasource.get_sqla_row_level_filters(
                        template_processor
                    )
                ]
                sql = build_mvt_tile_sql(
                    datasource,
                    source_sql,
                    geometry_column,
                    rls_filters,
                    cte,
                )

                with engine.connect() as connection:
                    tile = connection.execute(
                        sa.text(sql),
                        {"z": z, "x": x, "y": y},
                    ).scalar()
        except (QueryObjectValidationError, ValueError) as ex:
            logger.warning(
                "Invalid MVT tile request for datasource_id=%s z=%s x=%s y=%s: %s",
                datasource_id,
                z,
                x,
                y,
                ex,
            )
            return self.response_400(message=str(ex))
        except SQLAlchemyError as ex:
            logger.exception(
                "Database error generating MVT tile for datasource_id=%s z=%s x=%s "
                "y=%s sql=%s",
                datasource_id,
                z,
                x,
                y,
                sql,
            )
            message = "Failed to generate MVT tile"
            if current_app.config.get("DEBUG"):
                message = f"{message}: {ex}"
            return self.response(500, message=message)
        except Exception:
            logger.exception(
                "Failed to generate MVT tile for datasource_id=%s z=%s x=%s y=%s "
                "sql=%s",
                datasource_id,
                z,
                x,
                y,
                sql,
            )
            return self.response(500, message="Failed to generate MVT tile")

        return Response(
            bytes(tile or b""),
            status=200,
            mimetype="application/x-protobuf",
            headers={"Cache-Control": "public, max-age=60"},
        )

    @expose("/mapbox_api_key/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".mapbox_api_key",
        log_to_statsd=True,
    )
    def mapbox_api_key(self) -> Response:
        """
        Get the Mapbox API key from environment variables.
        ---
        get:
          summary: Get Mapbox API key
          responses:
            200:
              description: The Mapbox API key
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/MapboxApiKeySchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        result = self.mapbox_api_key_schema.dump(
            {"MAPBOX_API_KEY": os.environ.get("MAPBOX_API_KEY", "")}
        )
        return self.response(200, result=result)

    @expose("/schema/<version>", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".validate_schema",
        log_to_statsd=True,
    )
    @requires_json
    def validate_schema(self, version: str) -> Response:
        """
        Validate a GeoSetLayer JSON payload against a specific GeoSet layer schema.
        ---
        post:
          summary: Validate JSON against a GeoSet layer schema
          parameters:
            - in: path
              name: version
              schema:
                type: string
              required: true
              description: Schema version (e.g., "v1")
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            200:
              description: Schema validation successful
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/GeoSetLayerV1Schema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              description: Validation errors
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: object
                        description: Validation error details
        """
        schema = self.geoset_layer_schemas.get(version)
        if schema is None:
            return self.response_404()

        if request.json is None:
            return self.response_400(message="Request body is required")

        try:
            result = schema.load(request.json)
        except ValidationError as error:
            return self.response_422(message=error.messages)  # type: ignore[arg-type]

        return self.response(200, result=schema.dump(result))

    @expose("/schema/<from_version>/<to_version>", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".convert_schema",
        log_to_statsd=True,
    )
    @requires_json
    def convert_schema(self, from_version: str, to_version: str) -> Response:
        """
        Convert a GeoSetLayer JSON payload from one schema version to another.
        ---
        post:
          summary: Convert JSON from one GeoSet layer schema version to another
          parameters:
            - in: path
              name: from_version
              schema:
                type: string
              required: true
              description: Source schema version (e.g., "v1")
            - in: path
              name: to_version
              schema:
                type: string
              required: true
              description: Target schema version (e.g., "v2")
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            200:
              description: Schema conversion successful
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        description: Converted schema in target version format
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              description: Validation errors in source schema
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: object
                        description: Validation error details
        """
        logger.info(
            "[Migration] convert_schema called: %s -> %s", from_version, to_version
        )
        logger.info("[Migration] Request payload: %s", request.json)

        # Validate versions are different
        if from_version == to_version:
            logger.error("[Migration] Error: versions are the same")
            return self.response_400(
                message="from_version and to_version must be different"
            )

        # Validate version format and ordering
        from_num = parse_version_number(from_version)
        to_num = parse_version_number(to_version)

        if from_num is None or to_num is None:
            logger.error("[Migration] Error: invalid version format")
            return self.response_400(
                message="Invalid version format. Expected 'v1', 'v2', etc."
            )

        if from_num >= to_num:
            logger.error("[Migration] Error: from_version >= to_version")
            return self.response_400(
                message="from_version must be earlier than to_version"
            )

        # Validate versions exist
        from_schema = self.geoset_layer_schemas.get(from_version)
        to_schema = self.geoset_layer_schemas.get(to_version)

        if from_schema is None or to_schema is None:
            logger.error("[Migration] Error: schema not found")
            return self.response_404()

        # Build upgrade chain: walk from from_num to to_num one step at a time
        upgrade_chain = []
        for step in range(from_num, to_num):
            key = (f"v{step}", f"v{step + 1}")
            func = self.schema_upgrade_steps.get(key)
            if func is None:
                logger.error("[Migration] Error: missing upgrade step %s", key)
                return self.response_404()
            upgrade_chain.append(func)

        if request.json is None:
            logger.error("[Migration] Error: request body is None")
            return self.response_400(message="Request body is required")

        # Validate input against source schema
        try:
            logger.info("[Migration] Validating against source schema (%s)", from_version)
            from_schema.load(request.json)
            logger.info("[Migration] Source schema validation passed")
        except ValidationError as error:
            logger.error("[Migration] Source schema validation failed: %s", error.messages)
            return self.response_422(message=error.messages)  # type: ignore[arg-type]

        # Perform conversion by chaining each step
        logger.info("[Migration] Performing conversion through %d step(s)", len(upgrade_chain))
        converted = request.json
        for func in upgrade_chain:
            converted = func(converted)
        logger.info("[Migration] Converted payload: %s", converted)

        # Validate and return converted data
        try:
            logger.info("[Migration] Validating against target schema (%s)", to_version)
            result = to_schema.load(converted)
            logger.info("[Migration] Target schema validation passed")
        except ValidationError as error:
            logger.error("[Migration] Target schema validation failed: %s", error.messages)
            return self.response_422(message=error.messages)  # type: ignore[arg-type]

        logger.info("[Migration] Success! Returning result")
        return self.response(200, result=to_schema.dump(result))
