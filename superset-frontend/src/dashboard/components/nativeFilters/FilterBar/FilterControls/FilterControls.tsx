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
import {
  memo,
  Fragment,
  FC,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DataMask,
  DataMaskStateWithId,
  Filter,
  Divider,
  css,
  SupersetTheme,
  styled,
  t,
  isNativeFilterWithDataMask,
} from '@superset-ui/core';
import {
  createHtmlPortalNode,
  InPortal,
  OutPortal,
} from 'react-reverse-portal';
import { useSelector } from 'react-redux';
import {
  useDashboardHasTabs,
  useSelectFiltersInScope,
} from 'src/dashboard/components/nativeFilters/state';
import {
  FilterBarOrientation,
  FilterBarScopeVisibility,
  RootState,
} from 'src/dashboard/types';
import {
  DropdownContainer,
  type DropdownRef as DropdownContainerRef,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';
import { FiltersOutOfScopeCollapsible } from '../FiltersOutOfScopeCollapsible';
import { useFilterControlFactory } from '../useFilterControlFactory';
import { FiltersDropdownContent } from '../FiltersDropdownContent';
import crossFiltersSelector from '../CrossFilters/selectors';
import CrossFilter from '../CrossFilters/CrossFilter';
import { useFilterOutlined } from '../useFilterOutlined';
import { useChartsVerboseMaps } from '../utils';
import { getDisplayedFilters, getHiddenActiveFilterCount } from './utils';

const HiddenActiveFiltersNotice = styled.div`
  ${({ theme }) => css`
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
  `}
`;

type FilterControlsProps = {
  dataMaskSelected: DataMaskStateWithId;
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
  clearAllTriggers?: Record<string, boolean>;
  onClearAllComplete?: (filterId: string) => void;
};

const FilterControls: FC<FilterControlsProps> = ({
  dataMaskSelected,
  onFilterSelectionChange,
  clearAllTriggers,
  onClearAllComplete,
}) => {
  const filterBarOrientation = useSelector<RootState, FilterBarOrientation>(
    ({ dashboardInfo }) => dashboardInfo.filterBarOrientation,
  );

  const { outlinedFilterId, lastUpdated } = useFilterOutlined();

  const [overflowedIds, setOverflowedIds] = useState<string[]>([]);
  const popoverRef = useRef<DropdownContainerRef>(null);

  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const chartIds = useChartIds();
  const chartLayoutItems = useChartLayoutItems();
  const verboseMaps = useChartsVerboseMaps();

  const selectedCrossFilters = useMemo(
    () =>
      crossFiltersSelector({
        dataMask,
        chartIds,
        chartLayoutItems,
        verboseMaps,
      }),
    [chartIds, chartLayoutItems, dataMask, verboseMaps],
  );
  const { filterControlFactory, filtersWithValues } = useFilterControlFactory(
    dataMaskSelected,
    onFilterSelectionChange,
    clearAllTriggers,
    onClearAllComplete,
  );
  const portalNodes = useMemo(() => {
    const nodes = new Array(filtersWithValues.length);
    for (let i = 0; i < filtersWithValues.length; i += 1) {
      nodes[i] = createHtmlPortalNode();
    }
    return nodes;
  }, [filtersWithValues.length]);

  const filterIds = new Set(filtersWithValues.map(item => item.id));

  const [filtersInScope, filtersOutOfScope] =
    useSelectFiltersInScope(filtersWithValues);

  const scopeVisibility = useSelector<RootState, FilterBarScopeVisibility>(
    ({ dashboardInfo }) =>
      dashboardInfo.metadata?.filter_bar_scope_visibility ??
      FilterBarScopeVisibility.Group,
  );
  const displayedFilters = useMemo(
    () =>
      getDisplayedFilters(filtersWithValues, filtersInScope, scopeVisibility),
    [filtersWithValues, filtersInScope, scopeVisibility],
  );
  const hiddenActiveFilterCount = useMemo(
    () => getHiddenActiveFilterCount(filtersOutOfScope, scopeVisibility),
    [filtersOutOfScope, scopeVisibility],
  );
  const hiddenActiveFiltersNotice = hiddenActiveFilterCount > 0 && (
    <HiddenActiveFiltersNotice data-test="hidden-active-filters-notice">
      {t('Applied filters hidden by scope: %d', hiddenActiveFilterCount)}
    </HiddenActiveFiltersNotice>
  );

  const hasRequiredFirst = useMemo(
    () => filtersWithValues.some(filter => filter.requiredFirst),
    [filtersWithValues],
  );

  const dashboardHasTabs = useDashboardHasTabs();
  const showCollapsePanel =
    scopeVisibility === FilterBarScopeVisibility.Group &&
    dashboardHasTabs &&
    filtersWithValues.length > 0;

  const renderer = useCallback(
    ({ id }: Filter | Divider, index: number | undefined) => {
      const filterIndex = filtersWithValues.findIndex(f => f.id === id);
      const key = index ?? id;
      return (
        // Empty text node is to ensure there's always an element preceding
        // the OutPortal, otherwise react-reverse-portal crashes
        <Fragment key={key}>
          {'' /* eslint-disable-line react/jsx-curly-brace-presence */}
          <OutPortal node={portalNodes[filterIndex]} inView />
        </Fragment>
      );
    },
    [filtersWithValues, portalNodes],
  );

  const renderVerticalContent = useCallback(
    () => (
      <>
        {hiddenActiveFiltersNotice}
        {displayedFilters.map(renderer)}
        {showCollapsePanel && (
          <FiltersOutOfScopeCollapsible
            filtersOutOfScope={filtersOutOfScope}
            forceRender={hasRequiredFirst}
            renderer={renderer}
          />
        )}
      </>
    ),
    [
      displayedFilters,
      hiddenActiveFiltersNotice,
      renderer,
      showCollapsePanel,
      filtersOutOfScope,
      hasRequiredFirst,
    ],
  );

  const overflowedDisplayedFilters = useMemo(
    () => displayedFilters.filter(({ id }) => overflowedIds?.includes(id)),
    [displayedFilters, overflowedIds],
  );

  const overflowedCrossFilters = useMemo(
    () =>
      selectedCrossFilters.filter(({ emitterId, name }) =>
        overflowedIds?.includes(`${name}${emitterId}`),
      ),
    [overflowedIds, selectedCrossFilters],
  );

  const activeOverflowedFiltersInScope = useMemo(() => {
    const activeOverflowedFilters = overflowedDisplayedFilters.filter(filter =>
      isNativeFilterWithDataMask(filter),
    );
    return [...activeOverflowedFilters, ...overflowedCrossFilters];
  }, [overflowedCrossFilters, overflowedDisplayedFilters]);

  const rendererCrossFilter = useCallback(
    (crossFilter, orientation, last) => (
      <CrossFilter
        filter={crossFilter}
        orientation={orientation}
        last={
          displayedFilters.length > 0 &&
          `${last.name}${last.emitterId}` ===
            `${crossFilter.name}${crossFilter.emitterId}`
        }
      />
    ),
    [displayedFilters.length],
  );

  const items = useMemo(() => {
    const crossFilters = selectedCrossFilters.map(c => ({
      // a combination of filter name and chart id to account
      // for multiple cross filters from the same chart in the future
      id: `${c.name}${c.emitterId}`,
      element: rendererCrossFilter(
        c,
        FilterBarOrientation.Horizontal,
        selectedCrossFilters.at(-1),
      ),
    }));
    const nativeFiltersInScope = displayedFilters.map((filter, index) => ({
      id: filter.id,
      element: (
        <div
          className="filter-item-wrapper"
          css={css`
            flex-shrink: 0;
          `}
        >
          {renderer(filter, index)}
        </div>
      ),
    }));
    return [...crossFilters, ...nativeFiltersInScope];
  }, [displayedFilters, renderer, rendererCrossFilter, selectedCrossFilters]);

  const renderHorizontalContent = useCallback(
    () => (
      <div
        css={(theme: SupersetTheme) => css`
          padding: 0 ${theme.sizeUnit * 4}px;
          min-width: 0;
          flex: 1;
        `}
      >
        {hiddenActiveFiltersNotice}
        <DropdownContainer
          items={items}
          dropdownTriggerIcon={
            <Icons.FilterOutlined
              css={css`
                && {
                  margin-right: -4px;
                  display: flex;
                }
              `}
            />
          }
          dropdownTriggerText={t('More filters')}
          dropdownTriggerCount={activeOverflowedFiltersInScope.length}
          dropdownTriggerTooltip={
            activeOverflowedFiltersInScope.length === 0
              ? t('No applied filters')
              : t(
                  'Applied filters: %s',
                  activeOverflowedFiltersInScope
                    .map(filter => filter.name)
                    .join(', '),
                )
          }
          dropdownContent={
            overflowedDisplayedFilters.length ||
            overflowedCrossFilters.length ||
            (filtersOutOfScope.length && showCollapsePanel)
              ? () => (
                  <FiltersDropdownContent
                    overflowedCrossFilters={overflowedCrossFilters}
                    filtersInScope={overflowedDisplayedFilters}
                    filtersOutOfScope={filtersOutOfScope}
                    renderer={renderer}
                    rendererCrossFilter={rendererCrossFilter}
                    showCollapsePanel={showCollapsePanel}
                    forceRenderOutOfScope={hasRequiredFirst}
                  />
                )
              : undefined
          }
          forceRender={hasRequiredFirst}
          ref={popoverRef}
          onOverflowingStateChange={({ overflowed: nextOverflowedIds }) => {
            if (
              nextOverflowedIds.length !== overflowedIds.length ||
              overflowedIds.reduce(
                (a, b, i) => a || b !== nextOverflowedIds[i],
                false,
              )
            ) {
              setOverflowedIds(nextOverflowedIds);
            }
          }}
        />
      </div>
    ),
    [
      items,
      hiddenActiveFiltersNotice,
      activeOverflowedFiltersInScope,
      overflowedDisplayedFilters,
      overflowedCrossFilters,
      filtersOutOfScope,
      showCollapsePanel,
      renderer,
      rendererCrossFilter,
      hasRequiredFirst,
      overflowedIds,
    ],
  );

  const overflowedByIndex = useMemo(() => {
    const displayedFilterIds = new Set(displayedFilters.map(({ id }) => id));
    const overflowedDisplayedFilterIds = new Set(
      overflowedDisplayedFilters.map(({ id }) => id),
    );

    return filtersWithValues.map(
      filter =>
        !displayedFilterIds.has(filter.id) ||
        overflowedDisplayedFilterIds.has(filter.id),
    );
  }, [displayedFilters, filtersWithValues, overflowedDisplayedFilters]);

  useEffect(() => {
    if (outlinedFilterId && overflowedIds.includes(outlinedFilterId)) {
      popoverRef?.current?.open();
    }
  }, [outlinedFilterId, lastUpdated, popoverRef, overflowedIds]);

  return (
    <>
      {portalNodes
        .filter((node, index) => filterIds.has(filtersWithValues[index].id))
        .map((node, index) => (
          <InPortal node={node} key={filtersWithValues[index].id}>
            {filterControlFactory(
              index,
              filterBarOrientation,
              overflowedByIndex[index],
            )}
          </InPortal>
        ))}
      {filterBarOrientation === FilterBarOrientation.Vertical &&
        renderVerticalContent()}
      {filterBarOrientation === FilterBarOrientation.Horizontal &&
        renderHorizontalContent()}
    </>
  );
};

export default memo(FilterControls);
