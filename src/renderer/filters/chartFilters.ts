export type { IChartFilterState, IChartFilterCallbacks } from './filterState';
export { updateFilterCounters, updateToggleButtonStates, syncStageCheckboxes } from './filterCounters';
export { applyGroupOrCarFilterToDriverList, updateDriverItemsByStageAndFilter } from './filterBuilders';

import type { IParsedRallyData } from '../../shared/types';
import type { IChartFilterState, IChartFilterCallbacks } from './filterState';
import { applyGroupOrCarFilterToDriverList } from './filterBuilders';
import {
    buildStageFilterUI,
    buildDriverFilterUI,
    buildGroupFilterUI,
    buildCarFilterUI,
    buildCountryFilterUI,
} from './filterBuilders';

/**
 * Панель фильтров: одна и та же для графика (prefix '') и результатов (prefix 'res-') —
 * отличаются только id контейнеров и что делают колбэки.
 */
export function buildChartFilterPanel(
    data:      IParsedRallyData,
    state:     IChartFilterState,
    callbacks: IChartFilterCallbacks,
    rankMap:   Map<string, number | null>,
    prefix     = '',
): void {
    const refilter = () => applyGroupOrCarFilterToDriverList(data, state, prefix);
    buildStageFilterUI(data.stages, state, callbacks, prefix);
    buildDriverFilterUI(data.drivers, data, state, callbacks, rankMap, prefix);
    buildGroupFilterUI(data.groups, data, state, callbacks, refilter, prefix);
    buildCarFilterUI(data.drivers, state, callbacks, refilter, prefix);
    buildCountryFilterUI(data, state, callbacks, refilter, prefix);
}
