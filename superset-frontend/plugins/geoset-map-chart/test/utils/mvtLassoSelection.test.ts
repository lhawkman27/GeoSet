import { QueryFormData } from '@superset-ui/core';
import { buildMvtLassoQueryContext } from '../../src/utils/mvtLassoSelection';
import type { Coordinate } from '../../src/utils/measureDistance';

const polygon: Coordinate[] = [
  [-77, 38],
  [-76, 38],
  [-76, 39],
  [-77, 39],
];

const baseFormData = {
  datasource: '12__table',
  viz_type: 'geoset_map',
  geoJsonLayer: 'MVT',
  geojson: 'geom',
  row_limit: 500,
  hoverDataColumns: ['name'],
  featureInfoColumns: [{ column_name: 'status' }],
  geojsonConfig: JSON.stringify({
    colorByCategory: { dimension: 'type' },
    colorByValue: { valueColumn: 'score' },
    pointSize: { valueColumn: 'magnitude' },
  }),
  adhoc_filters: [
    {
      expressionType: 'SQL',
      sqlExpression: "status = 'active'",
      clause: 'WHERE',
    },
  ],
} as unknown as QueryFormData;

describe('buildMvtLassoQueryContext', () => {
  it('builds an authoritative PostGIS selection query for MVT lasso', () => {
    const queryContext = buildMvtLassoQueryContext(
      baseFormData,
      polygon,
    ) as any;
    const query = queryContext.queries[0];

    expect(query.row_limit).toBe(500);
    expect(query.metrics).toEqual([]);
    expect(query.groupby).toEqual([]);
    expect(query.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'geojson',
          sqlExpression: 'ST_AsGeoJSON(geom::geometry, 6)',
        }),
        'name',
        expect.objectContaining({ column_name: 'status' }),
        'type',
        'score',
        'magnitude',
      ]),
    );
    expect(query.extras.where).toContain("(status = 'active')");
    expect(query.extras.where).toContain('(ST_Intersects(geom::geometry');
    expect(query.extras.where).toContain('ST_GeomFromGeoJSON');
    expect(query.extras.where).toContain('[-77,38]');
    expect(query.extras.where).toContain('[-77,39],[-77,38]');
  });

  it('throws when no authoritative geometry column is configured', () => {
    expect(() =>
      buildMvtLassoQueryContext(
        { ...baseFormData, geojson: undefined } as QueryFormData,
        polygon,
      ),
    ).toThrow('MVT lasso requires a Geospatial Data column.');
  });
});
