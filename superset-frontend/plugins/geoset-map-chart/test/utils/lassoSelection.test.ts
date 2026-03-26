import {
  closeRing,
  filterFeaturesInLasso,
  normalizeCategoryKey,
} from '../../src/utils/lassoSelection';
import type { GeoJsonFeature } from '../../src/types';
import type { Coordinate } from '../../src/utils/measureDistance';

// Small square lasso polygon around [0,0]
const LASSO_SQUARE: Coordinate[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function makePoint(lng: number, lat: number): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {},
  };
}

function makeMultiPoint(coords: [number, number][]): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'MultiPoint', coordinates: coords },
    properties: {},
  };
}

function makeLine(coords: [number, number][]): GeoJsonFeature {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {},
  };
}

describe('closeRing', () => {
  it('returns input unchanged if already closed', () => {
    const ring: Coordinate[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ];
    expect(closeRing(ring)).toBe(ring);
  });

  it('appends first point if ring is not closed', () => {
    const ring: Coordinate[] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    const closed = closeRing(ring);
    expect(closed).toHaveLength(4);
    expect(closed[3]).toEqual([0, 0]);
  });

  it('returns input unchanged if fewer than 3 points', () => {
    const ring: Coordinate[] = [[0, 0]];
    expect(closeRing(ring)).toBe(ring);
  });
});

describe('normalizeCategoryKey', () => {
  it('trims and lowercases strings', () => {
    expect(normalizeCategoryKey('  Hello World  ')).toBe('hello world');
  });

  it('converts numbers to strings', () => {
    expect(normalizeCategoryKey(42)).toBe('42');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeCategoryKey(null)).toBe('');
    expect(normalizeCategoryKey(undefined)).toBe('');
  });
});

describe('filterFeaturesInLasso', () => {
  it('returns empty array when no features provided', () => {
    expect(filterFeaturesInLasso([], LASSO_SQUARE)).toEqual([]);
  });

  it('returns empty array when polygon has fewer than 3 coords', () => {
    const features = [makePoint(0, 0)];
    expect(
      filterFeaturesInLasso(features, [
        [0, 0],
        [1, 1],
      ]),
    ).toEqual([]);
  });

  it('selects Point features inside the lasso', () => {
    const inside = makePoint(0, 0);
    const outside = makePoint(5, 5);
    const result = filterFeaturesInLasso([inside, outside], LASSO_SQUARE);
    expect(result).toEqual([inside]);
  });

  it('selects MultiPoint features if any point is inside', () => {
    const mp = makeMultiPoint([
      [0, 0],
      [10, 10],
    ]);
    const result = filterFeaturesInLasso([mp], LASSO_SQUARE);
    expect(result).toEqual([mp]);
  });

  it('rejects MultiPoint features if no point is inside', () => {
    const mp = makeMultiPoint([
      [10, 10],
      [20, 20],
    ]);
    const result = filterFeaturesInLasso([mp], LASSO_SQUARE);
    expect(result).toEqual([]);
  });

  it('selects LineString features if any vertex is inside', () => {
    const line = makeLine([
      [0, 0],
      [10, 10],
    ]);
    const result = filterFeaturesInLasso([line], LASSO_SQUARE);
    expect(result).toEqual([line]);
  });

  it('rejects LineString features if no vertex is inside', () => {
    const line = makeLine([
      [10, 10],
      [20, 20],
    ]);
    const result = filterFeaturesInLasso([line], LASSO_SQUARE);
    expect(result).toEqual([]);
  });

  it('handles features with missing geometry gracefully', () => {
    const broken = {
      type: 'Feature',
      geometry: null,
      properties: {},
    } as unknown as GeoJsonFeature;
    expect(filterFeaturesInLasso([broken], LASSO_SQUARE)).toEqual([]);
  });
});
