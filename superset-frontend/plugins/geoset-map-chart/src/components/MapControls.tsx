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
  activeLassoLayerIds?: string[];
  onLassoLayerToggle?: (layerId: string) => void;
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

const DropdownPanel = styled.div(
  ({ theme }) => `
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  border-radius: 6px;
  box-shadow: 0 4px 12px ${theme.colorText}1F;
  overflow: hidden;
`,
);

const DropdownHeader = styled.div(
  ({ theme }) => `
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: ${theme.colorTextSecondary};
  border-bottom: 1px solid ${theme.colorBorderSecondary};
`,
);

const CloseButton = styled.button(
  ({ theme }) => `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: ${theme.colorTextSecondary};

  &:hover {
    color: ${theme.colorText};
  }
`,
);

const DropdownItem = styled.button(
  ({ theme }) => `
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  color: ${theme.colorText};
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${theme.colorBgTextHover};
  }
`,
);

const ModeToggleSection = styled.div(
  ({ theme }) => `
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid ${theme.colorBorderSecondary};
`,
);

const ModeButton = styled.button<{ $isActive?: boolean }>(
  ({ theme, $isActive }) => `
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 4px 8px;
  background: ${$isActive ? theme.colorPrimaryBg : 'transparent'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  color: ${$isActive ? theme.colorPrimary : theme.colorTextSecondary};
  white-space: nowrap;

  &:hover {
    background: ${$isActive ? theme.colorPrimaryBgHover : theme.colorBgTextHover};
  }
`,
);

const FreehandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path
      d="M2 10C4 4 6 12 8 8C10 4 12 11 14 6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const PolygonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path
      d="M3 12L6 3L13 5L11 13Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="3" cy="12" r="1.5" fill="currentColor" />
    <circle cx="6" cy="3" r="1.5" fill="currentColor" />
    <circle cx="13" cy="5" r="1.5" fill="currentColor" />
    <circle cx="11" cy="13" r="1.5" fill="currentColor" />
  </svg>
);

const CheckboxIcon = ({ checked }: { checked: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect
      x="1"
      y="1"
      width="14"
      height="14"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
      fill={checked ? 'currentColor' : 'none'}
    />
    {checked && (
      <polyline
        points="4.5 8 7 10.5 11.5 5.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    )}
  </svg>
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
  activeLassoLayerIds = [],
  onLassoLayerToggle,
  lassoDrawMode = 'freehand',
  onLassoDrawModeChange,
  position = 'top-left',
}: MapControlsProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMultipleLayers = lassoLayers.length > 1;

  // Close dropdown on outside click — activates lasso
  useEffect(() => {
    if (!isDropdownOpen) return undefined;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
        // Multi-layer requires at least one layer selected; single-layer always activates
        if (!hasMultipleLayers || activeLassoLayerIds.length > 0) {
          onLassoActivate?.();
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [
    isDropdownOpen,
    hasMultipleLayers,
    activeLassoLayerIds.length,
    onLassoActivate,
  ]);

  const handleLassoButtonClick = () => {
    if (isLassoActive) {
      onLassoToggle();
      setIsDropdownOpen(false);
    } else {
      setIsDropdownOpen(prev => !prev);
    }
  };

  const handleLayerToggle = (layerId: string) => {
    onLassoLayerToggle?.(layerId);
  };

  const handleCloseDropdown = () => {
    setIsDropdownOpen(false);
    if (!hasMultipleLayers || activeLassoLayerIds.length > 0) {
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
        <DropdownPanel>
          <DropdownHeader>
            {hasMultipleLayers ? 'Select layers' : 'Lasso mode'}
            <CloseButton onClick={handleCloseDropdown} title="Close">
              ✕
            </CloseButton>
          </DropdownHeader>
          {hasMultipleLayers &&
            lassoLayers.map(layer => {
              const isChecked = activeLassoLayerIds.includes(layer.id);
              return (
                <DropdownItem
                  key={layer.id}
                  onClick={() => handleLayerToggle(layer.id)}
                >
                  <CheckboxIcon checked={isChecked} />
                  {layer.name}
                </DropdownItem>
              );
            })}
          <ModeToggleSection>
            <ModeButton
              $isActive={lassoDrawMode === 'freehand'}
              onClick={() => onLassoDrawModeChange?.('freehand')}
            >
              <FreehandIcon /> Freehand
            </ModeButton>
            <ModeButton
              $isActive={lassoDrawMode === 'polygon'}
              onClick={() => onLassoDrawModeChange?.('polygon')}
            >
              <PolygonIcon /> Point-to-point
            </ModeButton>
          </ModeToggleSection>
        </DropdownPanel>
      )}
    </ControlsContainer>
  );
};

export default memo(MapControls);
