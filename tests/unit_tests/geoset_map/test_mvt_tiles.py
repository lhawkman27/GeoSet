from types import SimpleNamespace

import pytest

from superset.geoset_map.api import (
    build_mvt_cache_key,
    build_mvt_tile_sql,
    get_mvt_source_sql,
    get_mvt_property_columns,
    is_valid_tile_coordinate,
    quote_physical_table_name,
)


class FakeDatabase:
    @staticmethod
    def quote_identifier(identifier: str) -> str:
        return f'"{identifier}"'


def make_datasource(schema: str | None = "public") -> SimpleNamespace:
    return SimpleNamespace(
        id=32,
        changed_on="2026-07-07T12:00:00",
        database=FakeDatabase(),
        schema=schema,
        table_name="nhc_best_track",
    )


def make_virtual_datasource(
    from_clause: object,
    cte: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        kind="virtual",
        get_from_clause=lambda template_processor: (from_clause, cte),
    )


class FakeFromClause:
    def compile(self, **kwargs: object) -> str:
        return "(SELECT observation_point FROM nhc_best_track) AS virtual_table"


class FakeBareSelectFromClause:
    def compile(self, **kwargs: object) -> str:
        return "SELECT observation_point FROM nhc_best_track"


def test_is_valid_tile_coordinate() -> None:
    assert is_valid_tile_coordinate(0, 0, 0)
    assert is_valid_tile_coordinate(2, 3, 3)
    assert not is_valid_tile_coordinate(-1, 0, 0)
    assert not is_valid_tile_coordinate(31, 0, 0)
    assert not is_valid_tile_coordinate(2, 4, 0)
    assert not is_valid_tile_coordinate(2, 0, 4)


def test_quote_physical_table_name_with_schema() -> None:
    assert quote_physical_table_name(make_datasource()) == (
        '"public"."nhc_best_track"'
    )


def test_quote_physical_table_name_without_schema() -> None:
    assert quote_physical_table_name(make_datasource(None)) == '"nhc_best_track"'


def test_build_mvt_tile_sql_casts_geometry_and_applies_rls() -> None:
    sql = build_mvt_tile_sql(
        make_datasource(),
        '"public"."nhc_best_track"',
        "observation_point",
        ['"tenant_id" = 42'],
        [],
    )

    assert sql.startswith("\nWITH bounds AS")
    assert 'FROM "public"."nhc_best_track", bounds' in sql
    assert '"observation_point"::geometry IS NOT NULL' in sql
    assert (
        'ST_Intersects(ST_Transform(CASE WHEN ST_SRID("observation_point"::geometry) '
        '= 0 THEN ST_SetSRID("observation_point"::geometry, 4326) '
        'ELSE "observation_point"::geometry END, 3857), bounds.geom)'
    ) in sql
    assert '("tenant_id" = 42)' in sql
    assert "ST_AsMVT(mvtgeom, 'default', 4096, 'geom')" in sql


def test_build_mvt_tile_sql_rejects_invalid_identifiers() -> None:
    with pytest.raises(ValueError):
        build_mvt_tile_sql(
            make_datasource(),
            '"public"."nhc_best_track"',
            "observation_point; DROP TABLE users",
            [],
            [],
        )


def test_build_mvt_tile_sql_accepts_virtual_source_fragment() -> None:
    sql = build_mvt_tile_sql(
        make_datasource(),
        "(SELECT observation_point FROM nhc_best_track) AS virtual_table",
        "observation_point",
        [],
        [],
    )

    assert (
        "FROM (SELECT observation_point FROM nhc_best_track) AS virtual_table" in sql
    )


def test_get_mvt_source_sql_compiles_virtual_from_clause() -> None:
    datasource = make_virtual_datasource(FakeFromClause())
    engine = SimpleNamespace(dialect=object())

    assert get_mvt_source_sql(
        datasource,
        object(),
        engine,
        "observation_point",
        {},
        [],
    ) == (
        "(SELECT observation_point FROM nhc_best_track) AS virtual_table",
        None,
    )


def test_get_mvt_source_sql_wraps_bare_virtual_select() -> None:
    datasource = make_virtual_datasource(FakeBareSelectFromClause())
    engine = SimpleNamespace(dialect=object())

    assert get_mvt_source_sql(
        datasource,
        object(),
        engine,
        "observation_point",
        {},
        [],
    ) == (
        "(SELECT observation_point FROM nhc_best_track) AS virtual_table",
        None,
    )


def test_get_mvt_source_sql_returns_virtual_cte() -> None:
    datasource = make_virtual_datasource(
        FakeFromClause(),
        "WITH __cte AS (SELECT observation_point FROM nhc_best_track)",
    )
    engine = SimpleNamespace(dialect=object())

    assert get_mvt_source_sql(
        datasource,
        object(),
        engine,
        "observation_point",
        {},
        [],
    ) == (
        "(SELECT observation_point FROM nhc_best_track) AS virtual_table",
        "WITH __cte AS (SELECT observation_point FROM nhc_best_track)",
    )


def test_build_mvt_tile_sql_merges_virtual_cte_with_bounds_cte() -> None:
    sql = build_mvt_tile_sql(
        make_datasource(),
        "__cte",
        "observation_point",
        [],
        [],
        "WITH __cte AS (SELECT observation_point FROM nhc_best_track)",
    )

    assert sql.startswith(
        "WITH __cte AS (SELECT observation_point FROM nhc_best_track),\n"
        "bounds AS ("
    )


def test_build_mvt_cache_key_is_stable_for_same_inputs() -> None:
    datasource = make_datasource()
    key = build_mvt_cache_key(
        datasource,
        5,
        9,
        14,
        "observation_point",
        '"public"."nhc_best_track"',
        None,
        ['"tenant_id" = 42'],
        [],
        7,
    )

    assert key == build_mvt_cache_key(
        datasource,
        5,
        9,
        14,
        "observation_point",
        '"public"."nhc_best_track"',
        None,
        ['"tenant_id" = 42'],
        [],
        7,
    )
    assert key.startswith("geoset_mvt:")


def test_build_mvt_cache_key_varies_by_user_and_source_sql() -> None:
    datasource = make_datasource()
    base_key = build_mvt_cache_key(
        datasource,
        5,
        9,
        14,
        "observation_point",
        '"public"."nhc_best_track"',
        None,
        [],
        [],
        7,
    )

    assert base_key != build_mvt_cache_key(
        datasource,
        5,
        9,
        14,
        "observation_point",
        '"public"."nhc_best_track"',
        None,
        [],
        [],
        8,
    )
    assert base_key != build_mvt_cache_key(
        datasource,
        5,
        9,
        14,
        "observation_point",
        "(SELECT observation_point FROM nhc_best_track) AS virtual_table",
        None,
        [],
        [],
        7,
    )


def test_build_mvt_tile_sql_includes_property_columns() -> None:
    sql = build_mvt_tile_sql(
        make_datasource(),
        '"public"."nhc_best_track"',
        "observation_point",
        [],
        ["storm_name", "nhc_identifier"],
    )

    assert '"storm_name", "nhc_identifier"' in sql


def test_get_mvt_property_columns_includes_color_by_category_dimension() -> None:
    assert get_mvt_property_columns(
        {
            "geojsonConfig": {
                "colorByCategory": {"dimension": "storm_name"},
            },
            "hoverDataColumns": [{"column_name": "nhc_identifier"}],
        }
    ) == ["storm_name", "nhc_identifier"]


def test_get_mvt_property_columns_parses_string_geojson_config() -> None:
    assert get_mvt_property_columns(
        {
            "geojsonConfig": '{"colorByCategory":{"dimension":"storm_name"}}',
            "featureInfoColumns": [{"column_name": "max_gust_mph"}],
        }
    ) == ["storm_name", "max_gust_mph"]
