/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import area from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import centroid from '@turf/centroid';
import intersect from '@turf/intersect';
import { polygon as turfPolygon, point as turfPoint } from '@turf/helpers';
import type { Coordinate } from './measureDistance';
import type { GeoJsonFeature } from '../types';

/** Minimum overlap ratio (0–1) for a polygon to be captured by the lasso. */
const POLYGON_OVERLAP_THRESHOLD = 0.5;

export interface LassoSelectionResult {
  features: GeoJsonFeature[];
  count: number;
  byLayer: Record<string, GeoJsonFeature[]>;
}

/**
 * Get a representative [lng, lat] for any GeoJSON geometry type.
 * Used for point features and as a fallback for export coordinates.
 */
export function getRepresentativePoint(
  feature: GeoJsonFeature,
): [number, number] | null {
  const { geometry } = feature;
  if (!geometry || !geometry.type) return null;

  switch (geometry.type) {
    case 'Point':
      return geometry.coordinates as [number, number];
    case 'MultiPoint':
      return (geometry.coordinates?.[0] as [number, number]) ?? null;
    default: {
      try {
        const c = centroid(feature as any);
        return c.geometry.coordinates as [number, number];
      } catch {
        return null;
      }
    }
  }
}

/**
 * Ensure a polygon coordinate ring is closed (first point == last point).
 */
export function closeRing(coords: Coordinate[]): Coordinate[] {
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

/**
 * Test whether a feature intersects the lasso polygon.
 *
 * - Point / MultiPoint: direct point-in-polygon test (fast)
 * - Polygon / MultiPolygon: selected if >= 50% area overlap
 * - LineString / MultiLineString: selected if any vertex is inside
 */
function isFeatureInLasso(
  feature: GeoJsonFeature,
  lassoPoly: ReturnType<typeof turfPolygon>,
): boolean {
  const { geometry } = feature;
  if (!geometry || !geometry.type) return false;

  try {
    switch (geometry.type) {
      case 'Point': {
        const pt = geometry.coordinates as [number, number];
        return booleanPointInPolygon(turfPoint(pt), lassoPoly);
      }
      case 'MultiPoint': {
        // Selected if any point in the multi-point is inside
        return (geometry.coordinates as [number, number][]).some(pt =>
          booleanPointInPolygon(turfPoint(pt), lassoPoly),
        );
      }
      case 'Polygon':
      case 'MultiPolygon': {
        // Selected if >= 50% of the polygon's area is inside the lasso
        const featureArea = area(feature as any);
        if (featureArea === 0) return false;
        const overlap = intersect(
          { type: 'FeatureCollection', features: [feature as any, lassoPoly] },
        );
        if (!overlap) return false;
        return area(overlap) / featureArea >= POLYGON_OVERLAP_THRESHOLD;
      }
      case 'LineString': {
        // Selected if any vertex of the line is inside the lasso
        return (geometry.coordinates as [number, number][]).some(pt =>
          booleanPointInPolygon(turfPoint(pt), lassoPoly),
        );
      }
      case 'MultiLineString': {
        return (geometry.coordinates as [number, number][][]).some(line =>
          line.some(pt => booleanPointInPolygon(turfPoint(pt), lassoPoly)),
        );
      }
      default:
        // GeometryCollection, etc. — skip
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Filter features that intersect the lasso polygon.
 */
export function filterFeaturesInLasso(
  features: GeoJsonFeature[],
  lassoCoords: Coordinate[],
): GeoJsonFeature[] {
  if (!features.length || lassoCoords.length < 3) return [];

  const closed = closeRing(lassoCoords);
  const poly = turfPolygon([closed]);

  return features.filter(feature => isFeatureInLasso(feature, poly));
}

/**
 * Filter features from multiple layers, returning per-layer breakdown.
 */
export function filterMultiLayerFeaturesInLasso(
  layerFeatures: Record<string, GeoJsonFeature[]>,
  lassoCoords: Coordinate[],
): LassoSelectionResult {
  const byLayer: Record<string, GeoJsonFeature[]> = {};
  const allFeatures: GeoJsonFeature[] = [];

  Object.entries(layerFeatures).forEach(([layerName, features]) => {
    const selected = filterFeaturesInLasso(features, lassoCoords);
    if (selected.length > 0) {
      byLayer[layerName] = selected;
      allFeatures.push(...selected);
    }
  });

  return { features: allFeatures, count: allFeatures.length, byLayer };
}
