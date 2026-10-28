import type { IParsedRallyData, IStageInfo, IDriverInfo } from '../../shared/types.js';
import { i18n } from "../../i18n/index.js";
import {
    createElement,
    qsa
} from "../dom.js";
import {
    applyDriverSearch,
    buildSearchBox,
    reapplyDriverSearch
} from "./driverSearch.js";
import { buildCollapsibleFilterGroup } from "./filterGroup.js";
import {
    IChartFilterCallbacks,
    IChartFilterState,
    refreshVisibleDriverKeys,
    setAllCheckboxes,
    syncVisibleCheckboxes
} from "./filterState.js";

export function buildStageFilterUI(
    stages:    IStageInfo[],
    state:     IChartFilterState,
    callbacks: IChartFilterCallbacks,
): void {
    const cont = document.getElementById('filter-stages')!;
    cont.innerHTML = '';
    const { group, body, btnAll, btnNone } =
        buildCollapsibleFilterGroup(i18n.t().filterChartStages, 'counter-stages');

    btnAll.addEventListener('click', () => {
        stages.forEach(s => state.activeStageNums.add(s.num));
        setAllCheckboxes(body, true);
        callbacks.onStagesChanged();
    });
    btnNone.addEventListener('click', () => {
        state.activeStageNums.clear();
        setAllCheckboxes(body, false);
        callbacks.onStagesChanged();
    });

    for (const s of stages) {
        const lbl = createElement('label', 'filter-item');
        lbl.dataset['stageNum'] = String(s.num);
        const cb = createElement('input') as HTMLInputElement;
        cb.type = 'checkbox'; cb.checked = state.activeStageNums.has(s.num);
        cb.addEventListener('change', () => {
            cb.checked
                ? state.activeStageNums.add(s.num)
                : state.activeStageNums.delete(s.num);
            callbacks.onStagesChanged();
        });
        lbl.appendChild(cb);
        lbl.appendChild(createElement('span', 'filter-ss', `SS${s.num}`));
        lbl.appendChild(createElement('span', 'filter-name', s.name));
        body.appendChild(lbl);
    }
    cont.appendChild(group);
}

export function buildDriverFilterUI(
    drivers:   IDriverInfo[],
    data:      IParsedRallyData,
    state:     IChartFilterState,
    callbacks: IChartFilterCallbacks,
    rankMap:   Map<string, number | null>,
): void {
    const wrap = document.getElementById('filter-drivers-wrap')!;
    wrap.innerHTML = '';
    const { group, body, btnAll, btnNone } =
        buildCollapsibleFilterGroup(i18n.t().filterParticipants, 'counter-drivers');
    const t = i18n.t();

    // Сначала финишировавшие по месту, затем сошедшие по алфавиту
    const rankOf = (d: IDriverInfo) => rankMap.get(d.username) ?? null;
    const sorted = [...drivers].sort((a, b) => {
        const ra = rankOf(a), rb = rankOf(b);
        if (ra !== null && rb !== null) return ra - rb;
        if (ra !== null) return -1;
        if (rb !== null) return 1;
        return a.username.localeCompare(b.username);
    });

    btnAll.addEventListener('click', () => {
        drivers.filter(d => state.visibleDriverKeys.has(d.username))
            .forEach(d => state.activeDriverKeys.add(d.username));
        syncVisibleCheckboxes(body, true);
        callbacks.onDriversChanged();
    });
    btnNone.addEventListener('click', () => {
        drivers.filter(d => state.visibleDriverKeys.has(d.username))
            .forEach(d => state.activeDriverKeys.delete(d.username));
        syncVisibleCheckboxes(body, false);
        callbacks.onDriversChanged();
    });

    // Поиск только прячет строки — выбор участников и график не меняются
    buildSearchBox(body, (q) => applyDriverSearch(q, body));

    /** Оставляет выбранными только видимых (с учётом класса/поиска), прошедших отбор pick. */
    const applyPreset = (pick: (rank: number) => boolean) => {
        const visible = sorted.filter(d => state.visibleDriverKeys.has(d.username));
        const finishers = visible.filter(d => rankOf(d) !== null);
        visible.forEach(d => state.activeDriverKeys.delete(d.username));
        finishers.forEach((d, i) => { if (pick(i + 1)) state.activeDriverKeys.add(d.username); });
        qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
            const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (cb) cb.checked = state.activeDriverKeys.has(item.dataset['driverKey']!);
        });
        callbacks.onDriversChanged();
    };
    const presets = createElement('div', 'filter-presets');
    const addPreset = (label: string, title: string, pick: (rank: number) => boolean) => {
        const btn = createElement('button', 'btn-fa', label);
        btn.title = title;
        btn.addEventListener('click', () => applyPreset(pick));
        presets.appendChild(btn);
    };
    addPreset(t.presetTop(10), t.presetTopTitle(10), r => r <= 10);
    addPreset(t.presetTop(20), t.presetTopTitle(20), r => r <= 20);
    addPreset(t.presetFinished, t.presetFinishedTitle, () => true);
    body.appendChild(presets);

    for (const drv of sorted) {
        const lbl = createElement('label', 'filter-item');
        lbl.dataset['driverKey'] = drv.username;
        lbl.dataset['group']     = drv.group;
        lbl.dataset['car']       = drv.car;

        const cb = createElement('input') as HTMLInputElement;
        cb.type = 'checkbox'; cb.checked = state.activeDriverKeys.has(drv.username);
        cb.addEventListener('change', () => {
            cb.checked
                ? state.activeDriverKeys.add(drv.username)
                : state.activeDriverKeys.delete(drv.username);
            callbacks.onDriversChanged();
        });

        const rank     = rankOf(drv);
        const place    = createElement('span', rank !== null ? 'filter-driver-rank' : 'filter-driver-rank dnf',
            rank !== null ? String(rank) : 'DNF');
        const content  = createElement('div', 'filter-driver-content');
        const nameSpan = createElement('span', 'filter-driver-name',
            drv.realName && drv.realName !== drv.username
                ? `${drv.username} (${drv.realName})`
                : drv.username,
        );
        content.appendChild(nameSpan);
        if (drv.car) content.appendChild(createElement('span', 'filter-driver-car', drv.car));

        lbl.addEventListener('mouseenter', () => {
            lbl.classList.add('hover-highlighted');
            callbacks.onDriverHover(drv.username);
        });
        lbl.addEventListener('mouseleave', () => {
            lbl.classList.remove('hover-highlighted');
            callbacks.onDriverHover(null);
        });

        lbl.appendChild(cb);
        lbl.appendChild(place);
        lbl.appendChild(content);
        body.appendChild(lbl);
    }
    wrap.appendChild(group);
}

export function buildGroupFilterUI(
    groups:    string[],
    data:      IParsedRallyData,
    state:     IChartFilterState,
    callbacks: IChartFilterCallbacks,
    onRefilterDrivers: () => void,
): void {
    const cont = document.getElementById('filter-groups')!;
    cont.innerHTML = '';
    if (!groups.length) { cont.style.display = 'none'; return; }

    const { group, body, btnAll, btnNone } =
        buildCollapsibleFilterGroup(i18n.t().filterGroupClass, 'counter-groups');

    btnAll.addEventListener('click', () => {
        groups.forEach(g => state.activeGroups.add(g));
        setAllCheckboxes(body, true);
        onRefilterDrivers();
        callbacks.onGroupsChanged();
    });
    btnNone.addEventListener('click', () => {
        state.activeGroups.clear();
        setAllCheckboxes(body, false);
        onRefilterDrivers();
        callbacks.onGroupsChanged();
    });

    for (const grp of groups) {
        const lbl = createElement('label', 'filter-item');
        const cb  = createElement('input') as HTMLInputElement;
        cb.type = 'checkbox'; cb.checked = state.activeGroups.has(grp);
        cb.addEventListener('change', () => {
            cb.checked ? state.activeGroups.add(grp) : state.activeGroups.delete(grp);
            onRefilterDrivers();
            callbacks.onGroupsChanged();
        });
        lbl.appendChild(cb);
        lbl.appendChild(createElement('span', 'filter-group-label', grp));
        body.appendChild(lbl);
    }
    cont.appendChild(group);
}

export function buildCarFilterUI(
    drivers:   IDriverInfo[],
    state:     IChartFilterState,
    callbacks: IChartFilterCallbacks,
    onRefilterDrivers: () => void,
): void {
    const cont = document.getElementById('filter-cars')!;
    cont.innerHTML = '';
    const cars = [...new Set(drivers.map(d => d.car).filter(Boolean))].sort();
    if (!cars.length) { cont.style.display = 'none'; return; }

    const { group, body, btnAll, btnNone } =
        buildCollapsibleFilterGroup(i18n.t().filterCar, 'counter-cars');

    btnAll.addEventListener('click', () => {
        cars.forEach(c => state.activeCars.add(c));
        setAllCheckboxes(body, true);
        onRefilterDrivers();
        callbacks.onCarsChanged();
    });
    btnNone.addEventListener('click', () => {
        state.activeCars.clear();
        setAllCheckboxes(body, false);
        onRefilterDrivers();
        callbacks.onCarsChanged();
    });

    for (const car of cars) {
        const lbl = createElement('label', 'filter-item');
        const cb  = createElement('input') as HTMLInputElement;
        cb.type = 'checkbox'; cb.checked = state.activeCars.has(car);
        cb.addEventListener('change', () => {
            cb.checked ? state.activeCars.add(car) : state.activeCars.delete(car);
            onRefilterDrivers();
            callbacks.onCarsChanged();
        });
        lbl.appendChild(cb);
        lbl.appendChild(createElement('span', 'filter-car-label', car));
        body.appendChild(lbl);
    }
    cont.appendChild(group);
}

export function applyGroupOrCarFilterToDriverList(
    data:  IParsedRallyData,
    state: IChartFilterState,
): void {
    const body = document.querySelector<HTMLElement>('#filter-drivers-wrap .filter-body');
    if (!body) return;
    qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
        const grp   = item.dataset['group'] ?? '';
        const car   = item.dataset['car']   ?? '';
        const grpOk = !data.groups.length || state.activeGroups.has(grp);
        const carOk = !state.activeCars.size || state.activeCars.has(car);
        item.style.display = (grpOk && carOk) ? '' : 'none';
    });
    reapplyDriverSearch(body);
    refreshVisibleDriverKeys(body, state);
}

export function updateDriverItemsByStageAndFilter(
    data:      IParsedRallyData,
    state:     IChartFilterState,
    recordMap: Map<string, Map<number, any>>,
): void {
    const body = document.querySelector<HTMLElement>('#filter-drivers-wrap .filter-body');
    if (!body) return;
    const allSelected = state.activeStageNums.size === data.stages.length;

    qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
        const key   = item.dataset['driverKey']!;
        const grp   = item.dataset['group'] ?? '';
        const car   = item.dataset['car']   ?? '';
        const grpOk = !data.groups.length || state.activeGroups.has(grp);
        const carOk = !state.activeCars.size || state.activeCars.has(car);
        const stageOk = allSelected
            || [...state.activeStageNums].some(sn => recordMap.get(key)?.has(sn));
        item.style.display = (grpOk && carOk && stageOk) ? '' : 'none';
    });

    reapplyDriverSearch(body);
    refreshVisibleDriverKeys(body, state);
}
