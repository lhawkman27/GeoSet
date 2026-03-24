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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LassoDrawMode } from '../components/LassoOverlay';
import type { Coordinate } from '../utils/measureDistance';
import type { LassoLayer } from '../components/MapControls';
import type { GeoJsonFeature } from '../types';

export type UseLassoSelectionOptions = {
  /** Available layers for multi-layer selection. Omit or pass empty for single-layer. */
  availableLayers?: LassoLayer[];
  /** Called when lasso polygon drawing completes. */
  onPolygonComplete?: (polygon: Coordinate[]) => void;
  /** Called when lasso is activated (useful for deactivating other modes like ruler). */
  onActivate?: () => void;
};

export type UseLassoSelectionResult = {
  lassoIsActive: boolean;
  lassoDrawMode: LassoDrawMode;
  setLassoDrawMode: (mode: LassoDrawMode) => void;
  selectedLassoLayerId: string | undefined;
  selectedFeatures: GeoJsonFeature[];
  setSelectedFeatures: (features: GeoJsonFeature[]) => void;
  lassoPolygon: Coordinate[] | null;
  clearSelection: () => void;
  handleLassoToggle: () => void;
  handleLassoActivate: () => void;
  handleLassoComplete: (polygon: Coordinate[]) => void;
  handleLassoLayerSelect: (layerId: string) => void;
  deactivateLasso: () => void;
};

export function useLassoSelection(
  options: UseLassoSelectionOptions = {},
): UseLassoSelectionResult {
  const { availableLayers = [] } = options;

  // Use refs for callbacks to avoid stale closures without re-triggering effects
  const onPolygonCompleteRef = useRef(options.onPolygonComplete);
  onPolygonCompleteRef.current = options.onPolygonComplete;
  const onActivateRef = useRef(options.onActivate);
  onActivateRef.current = options.onActivate;

  const [lassoIsActive, setLassoIsActive] = useState(false);
  const [lassoDrawMode, setLassoDrawMode] = useState<LassoDrawMode>('freehand');
  const [selectedLassoLayerId, setSelectedLassoLayerId] = useState<
    string | undefined
  >();
  const [selectedFeatures, setSelectedFeatures] = useState<GeoJsonFeature[]>(
    [],
  );
  const [lassoPolygon, setLassoPolygon] = useState<Coordinate[] | null>(null);

  // Auto-select the first layer when available layers load and none is selected.
  const availableLayerIds = availableLayers.map(l => l.id).join(',');
  useEffect(() => {
    if (availableLayers.length > 0 && !selectedLassoLayerId) {
      setSelectedLassoLayerId(availableLayers[0].id);
    }
  }, [availableLayerIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deactivate lasso without clearing layer selections (soft deactivation for mode switching)
  const deactivateLasso = useCallback(() => {
    setLassoIsActive(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFeatures([]);
    setLassoPolygon(null);
  }, []);

  // Toggle lasso off — full reset including layer selection and results
  const handleLassoToggle = useCallback(() => {
    setLassoIsActive(false);
    setSelectedLassoLayerId(undefined);
    setSelectedFeatures([]);
    setLassoPolygon(null);
  }, []);

  // Activate lasso drawing and notify parent (e.g. to deactivate ruler)
  const handleLassoActivate = useCallback(() => {
    onActivateRef.current?.();
    setLassoIsActive(true);
  }, []);

  // Store completed polygon and forward to consumer
  const handleLassoComplete = useCallback((polygon: Coordinate[]) => {
    setLassoPolygon(polygon);
    onPolygonCompleteRef.current?.(polygon);
  }, []);

  // Select a single layer for lasso
  const handleLassoLayerSelect = useCallback((layerId: string) => {
    setSelectedLassoLayerId(layerId);
  }, []);

  // Escape key exits lasso mode
  useEffect(() => {
    if (!lassoIsActive) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLassoIsActive(false);
        setSelectedFeatures([]);
        setLassoPolygon(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lassoIsActive]);

  return {
    lassoIsActive,
    lassoDrawMode,
    setLassoDrawMode,
    selectedLassoLayerId,
    selectedFeatures,
    setSelectedFeatures,
    lassoPolygon,
    clearSelection,
    handleLassoToggle,
    handleLassoActivate,
    handleLassoComplete,
    handleLassoLayerSelect,
    deactivateLasso,
  };
}
