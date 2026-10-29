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

export function buildChartFilterPanel(
    data:      IParsedRallyData,
    state:     IChartFilterState,
    callbacks: IChartFilterCallbacks,
    rankMap:   Map<string, number | null>,
): void {
    buildStageFilterUI(data.stages, state, callbacks);
    buildDriverFilterUI(data.drivers, data, state, callbacks, rankMap);
    buildGroupFilterUI(
        data.groups, data, state, callbacks,
        () => applyGroupOrCarFilterToDriverList(data, state),
    );
    buildCarFilterUI(
        data.drivers, state, callbacks,
        () => applyGroupOrCarFilterToDriverList(data, state),
    );
    buildCountryFilterUI(
        data, state, callbacks,
        () => applyGroupOrCarFilterToDriverList(data, state),
    );
}
