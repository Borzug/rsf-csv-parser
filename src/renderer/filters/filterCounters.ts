import type { IParsedRallyData } from '../../shared/types';
import {
    type IChartFilterState,
    setCounterText,
    setToggleActive,
} from './filterState';

export function updateFilterCounters(
    data:  IParsedRallyData,
    state: IChartFilterState,
): void {
    const { activeStageNums, activeDriverKeys, activeGroups, activeCars, visibleDriverKeys } = state;

    setCounterText('counter-stages', activeStageNums.size, data.stages.length);

    const activeVisible = data.drivers.filter(
        d => visibleDriverKeys.has(d.username) && activeDriverKeys.has(d.username),
    ).length;
    setCounterText('counter-drivers', activeVisible, visibleDriverKeys.size);

    if (data.groups.length)
        setCounterText('counter-groups', activeGroups.size, data.groups.length);

    const allCars = [...new Set(data.drivers.map(d => d.car).filter(Boolean))];
    if (allCars.length)
        setCounterText('counter-cars', activeCars.size, allCars.length);
}

export function updateToggleButtonStates(
    data:  IParsedRallyData,
    state: IChartFilterState,
): void {
    const { activeStageNums, activeDriverKeys, activeGroups, activeCars, visibleDriverKeys } = state;

    const allSS = activeStageNums.size === data.stages.length && data.stages.length > 0;
    setToggleActive('#filter-stages .btn-fa:nth-child(1)', allSS);
    setToggleActive('#filter-stages .btn-fa:nth-child(2)', activeStageNums.size === 0);

    const vis    = [...visibleDriverKeys];
    const selVis = vis.filter(k => activeDriverKeys.has(k)).length;
    setToggleActive('#filter-drivers-wrap .btn-fa:nth-child(1)', selVis === vis.length && vis.length > 0);
    setToggleActive('#filter-drivers-wrap .btn-fa:nth-child(2)', selVis === 0);

    const allGrp = activeGroups.size === data.groups.length && data.groups.length > 0;
    setToggleActive('#filter-groups .btn-fa:nth-child(1)', allGrp);
    setToggleActive('#filter-groups .btn-fa:nth-child(2)', activeGroups.size === 0);

    const allCars = [...new Set(data.drivers.map(d => d.car).filter(Boolean))];
    setToggleActive('#filter-cars .btn-fa:nth-child(1)', activeCars.size === allCars.length && allCars.length > 0);
    setToggleActive('#filter-cars .btn-fa:nth-child(2)', activeCars.size === 0);
}

export function syncStageCheckboxes(activeStageNums: Set<number>): void {
    const body = document.querySelector<HTMLElement>('#filter-stages .filter-body');
    if (!body) return;
    body.querySelectorAll<HTMLElement>('.filter-item[data-stage-num]').forEach(item => {
        const num = parseInt(item.dataset['stageNum']!);
        const cb  = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (cb) cb.checked = activeStageNums.has(num);
    });
}
