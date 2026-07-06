/* eslint-disable no-console */
import {
  buildQueryContext,
  DataRecord,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';
import type { Coordinate } from './measureDistance';
import { parseRawFeatures } from './dataProcessing';
import { GeoJsonFeature } from '../types';

type AdhocSqlFilter = {
  expressionType: 'SQL';
  sqlExpression: string;
  clause: 'WHERE';
  subject: null;
  operator: null;
  comparator: null;
  isExtra: false;
  isNew: false;
  datasourceWarning: false;
  filterOptionName: string;
};

function getColumnName(column: any): string | undefined {
  if (!column) return undefined;
  if (typeof column === 'string') return column;
  return column.column_name || column.label || column.sqlExpression;
}

function uniqueColumns(columns: any[]) {
  const seen = new Set<string>();
  return columns.filter(col => {
    if (!col) return false;
    const key =
      typeof col === 'string'
        ? col
        : col.label || col.column_name || col.sqlExpression;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function closePolygon(coords: Coordinate[]): Coordinate[] {
  if (!coords.length) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

export function buildMvtLassoQueryContext(
  formData: QueryFormData,
  polygon: Coordinate[],
) {
  const geojsonCol = getColumnName(formData.geojson);
  if (!geojsonCol) {
    throw new Error('MVT lasso requires a Geospatial Data column.');
  }

  const lassoGeometry = {
    type: 'Polygon',
    coordinates: [closePolygon(polygon)],
  };
  const lassoGeojson = sqlStringLiteral(JSON.stringify(lassoGeometry));
  const geometryExpression = `${geojsonCol}::geometry`;
  const lassoExpression = `ST_SetSRID(ST_GeomFromGeoJSON(${lassoGeojson}), 4326)`;
  const spatialPredicate = `ST_Intersects(${geometryExpression}, ${lassoExpression})`;
  const spatialFilter: AdhocSqlFilter = {
    expressionType: 'SQL',
    sqlExpression: spatialPredicate,
    clause: 'WHERE',
    subject: null,
    operator: null,
    comparator: null,
    isExtra: false,
    isNew: false,
    datasourceWarning: false,
    filterOptionName: 'mvt_lasso_spatial_filter',
  };

  let geojsonConfig: any = {};
  try {
    geojsonConfig =
      typeof formData.geojsonConfig === 'string'
        ? JSON.parse(formData.geojsonConfig)
        : formData.geojsonConfig || {};
  } catch (err) {
    console.warn('[MVT lasso] Invalid geojsonConfig JSON:', err);
  }

  const colorByCategory = geojsonConfig?.colorByCategory ?? {};
  const colorByValue = geojsonConfig?.colorByValue ?? {};
  const dimension = colorByCategory.dimension || formData.dimension;
  const metricColumn = colorByValue.valueColumn;
  const pointSizeConfig = geojsonConfig?.pointSize;
  const sizeColumn =
    pointSizeConfig && typeof pointSizeConfig === 'object'
      ? pointSizeConfig.valueColumn
      : undefined;
  const hoverCols = (formData.hoverDataColumns ?? []) as any[];
  const featureCols = (formData.featureInfoColumns ?? []) as any[];
  const textLabelCol = formData.textLabelColumn;

  const columns = uniqueColumns([
    {
      label: 'geojson',
      sqlExpression: `ST_AsGeoJSON(${geometryExpression}, 6)`,
      expressionType: 'SQL',
    },
    dimension,
    ...hoverCols,
    ...featureCols,
    metricColumn,
    sizeColumn,
    textLabelCol,
  ]);

  const queryFormData = {
    ...formData,
    adhoc_filters: [
      ...((formData.adhoc_filters as any[]) || []),
      spatialFilter,
    ],
  };

  return buildQueryContext(queryFormData, baseQueryObject => [
    {
      ...baseQueryObject,
      columns,
      metrics: [],
      groupby: [],
      row_limit: Number(formData.row_limit) || 10000,
    },
  ]);
}

export async function fetchMvtLassoFeatures(
  formData: QueryFormData,
  polygon: Coordinate[],
  dimension?: string,
): Promise<GeoJsonFeature[]> {
  const queryContext = buildMvtLassoQueryContext(formData, polygon);
  const { json } = await SupersetClient.post({
    endpoint: '/api/v1/chart/data',
    jsonPayload: { ...queryContext },
  });
  const rows = (json?.result?.[0]?.data || []) as DataRecord[];
  return parseRawFeatures(rows, dimension, true);
}
