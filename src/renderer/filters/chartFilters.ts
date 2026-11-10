export type { IChartFilterState, IChartFilterCallbacks } from './filterState';
export { updateFilterCounters, updateToggleButtonStates, syncStageCheckboxes } from './filterCounters';
export { refilterDriverList } from './filterBuilders';

import type { IParsedRallyData, TRecordMap } from '../../shared/types';
import type { IChartFilterState, IChartFilterCallbacks } from './filterState';
import {
    buildStageFilterUI,
    buildDriverFilterUI,
    buildAttrFilters,
    refilterDriverList,
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
    recordMap: TRecordMap,
    prefix     = '',
): void {
    const refilter = () => refilterDriverList(data, state, recordMap, prefix);
    buildStageFilterUI(data.stages, state, {
        ...callbacks,
        onStagesChanged: () => { refilter(); callbacks.onStagesChanged(); },
    }, prefix);
    buildDriverFilterUI(data, state, callbacks, rankMap, prefix);
    buildAttrFilters(data, state, () => { refilter(); callbacks.onDriversChanged(); }, prefix);
    refilter();
}
