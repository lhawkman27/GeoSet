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
import { memo, useCallback, useState, useRef } from 'react';
import { styled } from '@superset-ui/core';
import type { GeoJsonFeature } from '../types';
import { exportToCSV, exportToExcel } from '../utils/lassoExport';
import { KebabIcon, CloseIcon, DownloadIcon } from './icons';
import { useClickOutside } from '../hooks/useClickOutside';

export interface LassoResultsBarProps {
  features: GeoJsonFeature[];
  onClear: () => void;
  anchorPosition?: { x: number; y: number } | null;
}

const CONTROL_MARGIN = 12;
const TOP_OFFSET = 32 + CONTROL_MARGIN + 8;

const BarContainer = styled.div<{ $anchorX?: number; $anchorY?: number }>`
  position: absolute;
  ${({ $anchorX, $anchorY }) =>
    $anchorX != null && $anchorY != null
      ? `left: ${$anchorX}px; top: ${$anchorY}px;`
      : `left: ${CONTROL_MARGIN}px; top: ${TOP_OFFSET}px;`}
  z-index: 20;
  pointer-events: auto;
`;

const BarContent = styled.div(
  ({ theme }) => `
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 8px 10px 16px;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${theme.colorText}1F;
  white-space: nowrap;
`,
);

const CountLabel = styled.span(
  ({ theme }) => `
  font-size: 15px;
  font-weight: 700;
  color: ${theme.colorText};
  margin-right: 4px;
`,
);

const IconButton = styled.button(
  ({ theme }) => `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: ${theme.colorTextSecondary};

  &:hover {
    background: ${theme.colorBgTextHover};
    color: ${theme.colorText};
  }
`,
);

const MenuPanel = styled.div(
  ({ theme }) => `
  position: absolute;
  top: 0;
  left: calc(100% + 6px);
  min-width: 170px;
  background: ${theme.colorBgElevated};
  border: 1px solid ${theme.colorBorderSecondary};
  border-radius: 6px;
  box-shadow: 0 4px 12px ${theme.colorText}1F;
  overflow: hidden;
`,
);

const MenuHeader = styled.div(
  ({ theme }) => `
  padding: 8px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colorTextSecondary};
  border-bottom: 1px solid ${theme.colorBorderSecondary};
`,
);

const MenuItem = styled.button<{ $disabled?: boolean }>(
  ({ theme, $disabled }) => `
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  cursor: ${$disabled ? 'default' : 'pointer'};
  font-family: inherit;
  font-size: 13px;
  color: ${$disabled ? theme.colorTextSecondary : theme.colorText};
  opacity: ${$disabled ? 0.5 : 1};
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${$disabled ? 'transparent' : theme.colorBgTextHover};
  }
`,
);

const LassoResultsBar = ({
  features,
  onClear,
  anchorPosition,
}: LassoResultsBarProps) => {
  const count = features.length;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  useClickOutside(containerRef, closeMenu, isMenuOpen);

  if (count === 0) return null;

  return (
    <BarContainer
      ref={containerRef}
      $anchorX={anchorPosition?.x}
      $anchorY={anchorPosition?.y}
    >
      <BarContent>
        <CountLabel>{count} Items Selected</CountLabel>
        <IconButton
          onClick={() => setIsMenuOpen(prev => !prev)}
          aria-label="Export options"
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          <KebabIcon />
        </IconButton>
        <IconButton onClick={onClear} aria-label="Clear selection">
          <CloseIcon />
        </IconButton>
      </BarContent>

      {isMenuOpen && (
        <MenuPanel role="menu" aria-label="Export formats">
          <MenuHeader>Download</MenuHeader>
          <MenuItem
            role="menuitem"
            onClick={() => {
              exportToCSV(features);
              setIsMenuOpen(false);
            }}
          >
            <DownloadIcon /> Export to .CSV
          </MenuItem>
          <MenuItem
            role="menuitem"
            onClick={() => {
              exportToExcel(features).catch(err => {
                // eslint-disable-next-line no-console
                console.error('Excel export failed:', err);
              });
              setIsMenuOpen(false);
            }}
          >
            <DownloadIcon /> Export to Excel
          </MenuItem>
        </MenuPanel>
      )}
    </BarContainer>
  );
};

export default memo(LassoResultsBar);
