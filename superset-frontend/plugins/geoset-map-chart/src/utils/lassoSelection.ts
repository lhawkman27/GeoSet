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
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import centroid from '@turf/centroid';
import { polygon as turfPolygon, point as turfPoint } from '@turf/helpers';
import type { Coordinate } from './measureDistance';
import type { GeoJsonFeature } from '../types';

export interface LassoSelectionResult {
  features: GeoJsonFeature[];
  count: number;
  byLayer: Record<string, GeoJsonFeature[]>;
}

/**
 * Get a representative [lng, lat] for any GeoJSON geometry type.
 * Points use coordinates directly; everything else uses @turf/centroid.
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
      return geometry.coordinates?.[0] as [number, number] ?? null;
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
function closeRing(coords: Coordinate[]): Coordinate[] {
  if (coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

/**
 * Filter features that have a representative point inside the lasso polygon.
 */
export function filterFeaturesInLasso(
  features: GeoJsonFeature[],
  lassoCoords: Coordinate[],
): GeoJsonFeature[] {
  if (!features.length || lassoCoords.length < 3) return [];

  const closed = closeRing(lassoCoords);
  const poly = turfPolygon([closed]);

  return features.filter(feature => {
    const pt = getRepresentativePoint(feature);
    if (!pt) return false;
    return booleanPointInPolygon(turfPoint(pt), poly);
  });
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
