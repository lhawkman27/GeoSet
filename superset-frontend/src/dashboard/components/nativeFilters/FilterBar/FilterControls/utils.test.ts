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
import { Divider, Filter, NativeFilterType } from '@superset-ui/core';
import { FilterBarScopeVisibility } from 'src/dashboard/types';
import { getDisplayedFilters, getHiddenActiveFilterCount } from './utils';

const allFilters = [{ id: 'in-scope' }, { id: 'out-of-scope' }] as (
  | Filter
  | Divider
)[];
const inScopeFilters = [allFilters[0]];

test.each([FilterBarScopeVisibility.Group, FilterBarScopeVisibility.Hide])(
  '%s only displays in-scope filters in the main filter list',
  visibility => {
    expect(getDisplayedFilters(allFilters, inScopeFilters, visibility)).toEqual(
      inScopeFilters,
    );
  },
);

test('SHOW displays all filters in the main filter list', () => {
  expect(
    getDisplayedFilters(
      allFilters,
      inScopeFilters,
      FilterBarScopeVisibility.Show,
    ),
  ).toEqual(allFilters);
});

test('Only counts active hidden native filters in HIDE mode', () => {
  const filters = [
    {
      id: 'active',
      type: NativeFilterType.NativeFilter,
      dataMask: { filterState: { value: ['selected'] } },
    },
    {
      id: 'inactive',
      type: NativeFilterType.NativeFilter,
      dataMask: { filterState: { value: undefined } },
    },
    { id: 'divider', type: NativeFilterType.Divider },
  ] as (Filter | Divider)[];

  expect(
    getHiddenActiveFilterCount(filters, FilterBarScopeVisibility.Hide),
  ).toBe(1);
  expect(
    getHiddenActiveFilterCount(filters, FilterBarScopeVisibility.Group),
  ).toBe(0);
});
