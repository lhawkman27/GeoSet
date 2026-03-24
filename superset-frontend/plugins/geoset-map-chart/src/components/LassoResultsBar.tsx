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
import type { GeoJsonFeature } from '../types';
import { exportToCSV, exportToExcel } from '../utils/lassoExport';

export interface LassoResultsBarProps {
  count: number;
  features: GeoJsonFeature[];
  onClear: () => void;
}

const CONTROL_MARGIN = 12;
// MapControls bar height (32px) + gap
const TOP_OFFSET = 32 + CONTROL_MARGIN + 8;

const BarContainer = styled.div`
  position: absolute;
  top: ${TOP_OFFSET}px;
  left: ${CONTROL_MARGIN}px;
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

const KebabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="3" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="13" r="1.5" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="4" y1="4" x2="12" y2="12" />
    <line x1="12" y1="4" x2="4" y2="12" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 2v8M4 7l4 4 4-4M2 13h12" />
  </svg>
);

const LassoResultsBar = ({
  count,
  features,
  onClear,
}: LassoResultsBarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  if (count === 0) return null;

  return (
    <BarContainer ref={containerRef}>
      <BarContent>
        <CountLabel>{count} Items Selected</CountLabel>
        <IconButton
          onClick={() => setIsMenuOpen(prev => !prev)}
          title="Export options"
        >
          <KebabIcon />
        </IconButton>
        <IconButton onClick={onClear} title="Clear selection">
          <CloseIcon />
        </IconButton>
      </BarContent>

      {isMenuOpen && (
        <MenuPanel>
          <MenuHeader>Download</MenuHeader>
          <MenuItem
            onClick={() => {
              exportToCSV(features);
              setIsMenuOpen(false);
              onClear();
            }}
          >
            <DownloadIcon /> Export to .CSV
          </MenuItem>
          <MenuItem
            onClick={() => {
              exportToExcel(features).then(() => onClear());
              setIsMenuOpen(false);
            }}
          >
            <DownloadIcon /> Export to Excel
          </MenuItem>
          <MenuItem $disabled title="Coming soon">
            <DownloadIcon /> Download as image
          </MenuItem>
        </MenuPanel>
      )}
    </BarContainer>
  );
};

export default memo(LassoResultsBar);
