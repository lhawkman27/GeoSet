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
import { memo } from 'react';
import { styled } from '@superset-ui/core';
import type { LassoDrawMode } from './LassoOverlay';
import type { LassoLayer } from './MapControls';

export type LassoDropdownProps = {
  hasMultipleLayers: boolean;
  layers: LassoLayer[];
  activeLassoLayerId?: string;
  onLayerSelect?: (layerId: string) => void;
  drawMode: LassoDrawMode;
  onDrawModeChange?: (mode: LassoDrawMode) => void;
  onClose: () => void;
};

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

const RadioIcon = ({ selected }: { selected: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle
      cx="8"
      cy="8"
      r="6.5"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    />
    {selected && <circle cx="8" cy="8" r="3.5" fill="currentColor" />}
  </svg>
);

const LassoDropdown = ({
  hasMultipleLayers,
  layers,
  activeLassoLayerId,
  onLayerSelect,
  drawMode,
  onDrawModeChange,
  onClose,
}: LassoDropdownProps) => (
  <DropdownPanel>
    <DropdownHeader>
      {hasMultipleLayers ? 'Select layer' : 'Lasso mode'}
      <CloseButton onClick={onClose} title="Close">
        ✕
      </CloseButton>
    </DropdownHeader>
    {hasMultipleLayers &&
      layers.map(layer => {
        const isSelected = layer.id === activeLassoLayerId;
        return (
          <DropdownItem
            key={layer.id}
            onClick={() => onLayerSelect?.(layer.id)}
          >
            <RadioIcon selected={isSelected} />
            {layer.name}
          </DropdownItem>
        );
      })}
    <ModeToggleSection>
      <ModeButton
        $isActive={drawMode === 'freehand'}
        onClick={() => onDrawModeChange?.('freehand')}
      >
        <FreehandIcon /> Click-and-drag
      </ModeButton>
      <ModeButton
        $isActive={drawMode === 'polygon'}
        onClick={() => onDrawModeChange?.('polygon')}
      >
        <PolygonIcon /> Point-to-point
      </ModeButton>
    </ModeToggleSection>
  </DropdownPanel>
);

export default memo(LassoDropdown);
