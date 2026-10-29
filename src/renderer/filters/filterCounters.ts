import type { IParsedRallyData } from '../../shared/types';
import {
    type IChartFilterState,
    filterId,
    setCounterText,
    setToggleActive,
} from './filterState';

export function updateFilterCounters(
    data:   IParsedRallyData,
    state:  IChartFilterState,
    prefix = '',
): void {
    const { activeStageNums, activeDriverKeys, activeGroups, activeCars, visibleDriverKeys } = state;
    const id = (name: string) => filterId(prefix, name);

    setCounterText(id('counter-stages'), activeStageNums.size, data.stages.length);

    const activeVisible = data.drivers.filter(
        d => visibleDriverKeys.has(d.username) && activeDriverKeys.has(d.username),
    ).length;
    setCounterText(id('counter-drivers'), activeVisible, visibleDriverKeys.size);

    if (data.groups.length)
        setCounterText(id('counter-groups'), activeGroups.size, data.groups.length);

    const allCars = [...new Set(data.drivers.map(d => d.car).filter(Boolean))];
    if (allCars.length)
        setCounterText(id('counter-cars'), activeCars.size, allCars.length);

    if (data.countries.length)
        setCounterText(id('counter-countries'), state.activeCountries.size, data.countries.length);
}

export function updateToggleButtonStates(
    data:   IParsedRallyData,
    state:  IChartFilterState,
    prefix = '',
): void {
    const { activeStageNums, activeDriverKeys, activeGroups, activeCars, visibleDriverKeys } = state;
    const sel = (name: string, n: 1 | 2) => `#${filterId(prefix, name)} .filter-header .btn-fa:nth-child(${n})`;

    const allSS = activeStageNums.size === data.stages.length && data.stages.length > 0;
    setToggleActive(sel('filter-stages', 1), allSS);
    setToggleActive(sel('filter-stages', 2), activeStageNums.size === 0);

    const vis    = [...visibleDriverKeys];
    const selVis = vis.filter(k => activeDriverKeys.has(k)).length;
    setToggleActive(sel('filter-drivers-wrap', 1), selVis === vis.length && vis.length > 0);
    setToggleActive(sel('filter-drivers-wrap', 2), selVis === 0);

    const allGrp = activeGroups.size === data.groups.length && data.groups.length > 0;
    setToggleActive(sel('filter-groups', 1), allGrp);
    setToggleActive(sel('filter-groups', 2), activeGroups.size === 0);

    const allCars = [...new Set(data.drivers.map(d => d.car).filter(Boolean))];
    setToggleActive(sel('filter-cars', 1), activeCars.size === allCars.length && allCars.length > 0);
    setToggleActive(sel('filter-cars', 2), activeCars.size === 0);

    const nCty = data.countries.length;
    setToggleActive(sel('filter-countries', 1), state.activeCountries.size === nCty && nCty > 0);
    setToggleActive(sel('filter-countries', 2), state.activeCountries.size === 0);
}

export function syncStageCheckboxes(activeStageNums: Set<number>, prefix = ''): void {
    const body = document.querySelector<HTMLElement>(`#${filterId(prefix, 'filter-stages')} .filter-body`);
    if (!body) return;
    body.querySelectorAll<HTMLElement>('.filter-item[data-stage-num]').forEach(item => {
        const num = parseInt(item.dataset['stageNum']!);
        const cb  = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (cb) cb.checked = activeStageNums.has(num);
    });
}
