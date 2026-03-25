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
import { memo, useState, useRef, useEffect } from 'react';
import { styled } from '@superset-ui/core';

import type { LassoDrawMode } from './LassoOverlay';
import LassoDropdown from './LassoDropdown';

export type LassoLayer = { id: string; name: string };

export type MapControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onRulerToggle: () => void;
  isRulerActive: boolean;
  onLassoToggle: () => void;
  onLassoActivate?: () => void;
  isLassoActive: boolean;
  lassoLayers?: LassoLayer[];
  activeLassoLayerId?: string;
  onLassoLayerSelect?: (layerId: string) => void;
  lassoDrawMode?: LassoDrawMode;
  onLassoDrawModeChange?: (mode: LassoDrawMode) => void;
  position?: 'top-left' | 'top-right';
};

// Control margin matching the legend padding
const CONTROL_MARGIN = 12;

const ControlsContainer = styled.div<{ $position: 'top-left' | 'top-right' }>`
  position: absolute;
  top: ${CONTROL_MARGIN}px;
  ${({ $position }) =>
    $position === 'top-right'
      ? `right: ${CONTROL_MARGIN}px;`
      : `left: ${CONTROL_MARGIN}px;`}
  z-index: 20;
  pointer-events: auto;
`;

const ButtonGroup = styled.div(
  ({ theme }) => `
  display: flex;
  flex-direction: row;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  border-radius: 6px;
  box-shadow: 0 2px 6px ${theme.colorBorderSecondary}1F;
  overflow: hidden;
`,
);

const ControlButton = styled.button<{ $isActive?: boolean }>(
  ({ theme, $isActive }) => `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: ${$isActive ? theme.colorPrimaryBg : 'transparent'};
  border: none;
  border-right: 1px solid ${theme.colorBorderSecondary};
  cursor: pointer;
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  color: ${$isActive ? theme.colorPrimary : theme.colorText};
  transition: background 0.15s ease, color 0.15s ease;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: ${$isActive ? theme.colorPrimaryBgHover : theme.colorBgTextHover};
  }

  &:active {
    background: ${$isActive ? theme.colorPrimaryBgHover : theme.colorBgTextActive};
  }
`,
);

const HomeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const RulerIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
    <path d="m14.5 12.5 2-2" />
    <path d="m11.5 9.5 2-2" />
    <path d="m8.5 6.5 2-2" />
    <path d="m17.5 15.5 2-2" />
  </svg>
);

const LassoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    {/* Lasso rope loop — open at bottom-right leading into cursor */}
    <path
      d="M 15 13 C 22 10 23 4 17 1 C 12 0 5 1 2 6 C 0 11 4 15 9 15"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    {/* Solid cursor arrow pointing lower-right */}
    <path
      d="M11 15 L11 22 L13.5 19.5 L15.5 22.5 L17 21.5 L15 18.5 L18.5 18.5 Z"
      fill="currentColor"
    />
  </svg>
);

const MapControls = ({
  onZoomIn,
  onZoomOut,
  onResetView,
  onRulerToggle,
  isRulerActive,
  onLassoToggle,
  onLassoActivate,
  isLassoActive,
  lassoLayers = [],
  activeLassoLayerId,
  onLassoLayerSelect,
  lassoDrawMode = 'freehand',
  onLassoDrawModeChange,
  position = 'top-left',
}: MapControlsProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMultipleLayers = lassoLayers.length > 1;

  // Close dropdown on outside click — activates lasso if a layer is selected
  useEffect(() => {
    if (!isDropdownOpen) return undefined;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
        if (!hasMultipleLayers || activeLassoLayerId) {
          onLassoActivate?.();
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDropdownOpen, hasMultipleLayers, activeLassoLayerId, onLassoActivate]);

  const handleLassoButtonClick = () => {
    if (isLassoActive) {
      onLassoToggle();
      setIsDropdownOpen(false);
    } else {
      setIsDropdownOpen(prev => !prev);
    }
  };

  const handleCloseDropdown = () => {
    setIsDropdownOpen(false);
    if (!hasMultipleLayers || activeLassoLayerId) {
      onLassoActivate?.();
    }
  };

  return (
    <ControlsContainer $position={position} ref={containerRef}>
      <ButtonGroup>
        <ControlButton onClick={onResetView} title="Reset view">
          <HomeIcon />
        </ControlButton>
        <ControlButton onClick={onZoomOut} title="Zoom out">
          −
        </ControlButton>
        <ControlButton onClick={onZoomIn} title="Zoom in">
          +
        </ControlButton>
        <ControlButton
          onClick={onRulerToggle}
          title={isRulerActive ? 'Exit measure mode (Esc)' : 'Measure distance'}
          $isActive={isRulerActive}
        >
          <RulerIcon />
        </ControlButton>
        <ControlButton
          onClick={handleLassoButtonClick}
          title={
            isLassoActive ? 'Exit lasso mode (Esc)' : 'Lasso select features'
          }
          $isActive={isLassoActive || isDropdownOpen}
        >
          <LassoIcon />
        </ControlButton>
      </ButtonGroup>

      {isDropdownOpen && (
        <LassoDropdown
          hasMultipleLayers={hasMultipleLayers}
          layers={lassoLayers}
          activeLassoLayerId={activeLassoLayerId}
          onLayerSelect={onLassoLayerSelect}
          drawMode={lassoDrawMode}
          onDrawModeChange={onLassoDrawModeChange}
          onClose={handleCloseDropdown}
        />
      )}
    </ControlsContainer>
  );
};

export default memo(MapControls);
