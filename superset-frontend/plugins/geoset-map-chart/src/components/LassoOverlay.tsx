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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EditableGeoJsonLayer,
  DrawPolygonByDraggingMode,
  DrawPolygonMode,
  ViewMode,
} from '@deck.gl-community/editable-layers';
import type { Coordinate } from '../utils/measureDistance';

export type LassoDrawMode = 'freehand' | 'polygon';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [] as any[],
};

// Custom crosshair cursor for lasso drawing mode
export const LASSO_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='5' fill='none' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='16' y1='8' x2='16' y2='13' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='16' y1='19' x2='16' y2='24' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='8' y1='16' x2='13' y2='16' stroke='%23000' stroke-width='1.5'/%3E%3Cline x1='19' y1='16' x2='24' y2='16' stroke='%23000' stroke-width='1.5'/%3E%3C/svg%3E") 16 16, crosshair`;

const DRAW_MODES = {
  freehand: DrawPolygonByDraggingMode,
  polygon: DrawPolygonMode,
};

/**
 * Hook to create an EditableGeoJsonLayer for lasso drawing.
 * Supports freehand (drag) and point-to-point (click vertices, double-click to close).
 */
export function useLassoLayer(
  isActive: boolean,
  onPolygonComplete: (polygon: Coordinate[]) => void,
  drawMode: LassoDrawMode = 'freehand',
): { layers: any[] } {
  const [data, setData] = useState(EMPTY_FEATURE_COLLECTION);
  const [mode, setMode] = useState<any>(() => DRAW_MODES[drawMode]);

  // Reset when lasso is activated or deactivated
  useEffect(() => {
    if (isActive) {
      setData(EMPTY_FEATURE_COLLECTION);
      setMode(() => DRAW_MODES[drawMode]);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch draw mode while active (without resetting polygon data)
  useEffect(() => {
    if (isActive) {
      setMode(() => DRAW_MODES[drawMode]);
    }
  }, [drawMode, isActive]);

  const handleEdit = useCallback(
    ({ updatedData, editType }: { updatedData: any; editType: string }) => {
      setData(updatedData);
      if (editType === 'addFeature') {
        // Polygon drawing complete — extract coordinates and switch to view mode
        const lastFeature =
          updatedData.features[updatedData.features.length - 1];
        const coords: number[][] = lastFeature.geometry.coordinates[0];
        setMode(() => ViewMode);
        onPolygonComplete(coords.map(c => [c[0], c[1]] as Coordinate));
      }
    },
    [onPolygonComplete],
  );

  const layers = useMemo(() => {
    if (!isActive) return [];

    return [
      new EditableGeoJsonLayer({
        id: 'lasso-editable-layer',
        data,
        mode,
        selectedFeatureIndexes: [],
        onEdit: handleEdit,

        // Completed polygon styling
        getFillColor: [66, 133, 244, 40],
        getLineColor: [50, 50, 50, 200],
        lineWidthMinPixels: 2,

        // Tentative polygon styling (while drawing)
        getTentativeFillColor: [66, 133, 244, 20],
        getTentativeLineColor: [50, 50, 50, 180],

        pickable: true,
      }),
    ];
  }, [isActive, data, mode, handleEdit]);

  return { layers };
}
