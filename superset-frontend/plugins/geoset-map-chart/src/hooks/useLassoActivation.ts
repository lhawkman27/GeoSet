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
import type { LassoLayer } from '../components/MapControls';

export type UseLassoActivationOptions = {
  availableLayers?: LassoLayer[];
  onActivate?: () => void;
};

export type UseLassoActivationResult = {
  lassoIsActive: boolean;
  lassoDrawMode: LassoDrawMode;
  setLassoDrawMode: (mode: LassoDrawMode) => void;
  selectedLassoLayerId: string | undefined;
  handleLassoActivate: () => void;
  handleLassoLayerSelect: (layerId: string) => void;
  deactivateLasso: () => void;
  /** Full reset: deactivate + clear layer selection. Call `onFullReset` too. */
  resetActivation: () => void;
};

export function useLassoActivation(
  options: UseLassoActivationOptions = {},
): UseLassoActivationResult {
  const { availableLayers = [] } = options;

  const onActivateRef = useRef(options.onActivate);
  onActivateRef.current = options.onActivate;

  const [lassoIsActive, setLassoIsActive] = useState(false);
  const [lassoDrawMode, setLassoDrawMode] = useState<LassoDrawMode>('freehand');
  const [selectedLassoLayerId, setSelectedLassoLayerId] = useState<
    string | undefined
  >();

  // Auto-select the first available layer when none is selected.
  const availableLayerIds = availableLayers.map(l => l.id).join(',');
  useEffect(() => {
    if (availableLayers.length > 0 && !selectedLassoLayerId) {
      setSelectedLassoLayerId(availableLayers[0].id);
    }
  }, [availableLayerIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetActivation = useCallback(() => {
    setLassoIsActive(false);
    setSelectedLassoLayerId(undefined);
  }, []);

  const deactivateLasso = useCallback(() => {
    setLassoIsActive(false);
  }, []);

  const handleLassoActivate = useCallback(() => {
    onActivateRef.current?.();
    setLassoIsActive(true);
  }, []);

  const handleLassoLayerSelect = useCallback((layerId: string) => {
    setSelectedLassoLayerId(layerId);
  }, []);

  return {
    lassoIsActive,
    lassoDrawMode,
    setLassoDrawMode,
    selectedLassoLayerId,
    handleLassoActivate,
    handleLassoLayerSelect,
    deactivateLasso,
    resetActivation,
  };
}
