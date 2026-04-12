import type { IParsedRallyData } from '../../shared/types.js';
import { i18n } from "../../i18n/index.js";
import {
    createElement,
    qsa
} from "../dom.js";
import { buildCollapsibleFilterGroup } from "../filters/filterGroup.js";

export interface IResultsFilterState {
    stageFilter:      Set<number>;
    groupFilter:      Set<string>;
    driverFilter:     Set<string>;
    activeDriverKeys: Set<string>;
}

export function buildResultsFilterPanel(
    data:     IParsedRallyData,
    state:    IResultsFilterState,
    onChange: () => void,
    onApply:  (selected: Set<string>) => void,
): void {
    const cont = document.getElementById('sidebar-results-filters')!;
    cont.innerHTML = '';

    buildResultsStageFilter(data, state, onChange, cont);
    buildResultsDriverFilter(data, state, onChange, cont);
    if (data.groups.length) buildResultsGroupFilter(data, state, onChange, cont);

    updateResultsFilterCounters(data, state);
    wireApplyButton(onApply);
}

export function updateResultsFilterCounters(
    data:  IParsedRallyData,
    state: IResultsFilterState,
): void {
    setCounter('counter-res-stages',  state.stageFilter.size, data.stages.length);
    if (data.groups.length) setCounter('counter-res-groups', state.groupFilter.size, data.groups.length);

    const active = state.driverFilter.size > 0 ? state.driverFilter.size : data.drivers.length;
    setCounter('counter-res-drivers', active, data.drivers.length);
}

export function syncResultsDriverCheckboxes(
    data:  IParsedRallyData,
    state: IResultsFilterState,
): void {
    const body = document.querySelector<HTMLElement>(
        '#sidebar-results-filters .filter-body[data-filter="drivers"]',
    );
    if (!body) return;

    const applied = state.driverFilter;
    state.activeDriverKeys.clear();

    qsa<HTMLElement>('.filter-item', body).forEach(item => {
        const cb   = item.querySelector<HTMLInputElement>('input[type=checkbox]');
        const nmEl = item.querySelector('.filter-driver-name');
        if (!cb || !nmEl) return;
        const text = nmEl.textContent ?? '';
        const drv  = data.drivers.find(d =>
            (d.realName && d.realName !== d.username
                ? `${d.username} (${d.realName})` : d.username) === text,
        );
        if (drv) {
            const checked = applied.size === 0 || applied.has(drv.username);
            cb.checked = checked;
            if (checked) state.activeDriverKeys.add(drv.username);
        }
    });
}

// ── Private builders ──────────────────────────────────────────────────────────

function buildResultsStageFilter(
    data:    IParsedRallyData,
    state:   IResultsFilterState,
    onChange: () => void,
    cont:    HTMLElement,
): void {
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(
        i18n.t().filterResultsStages, 'counter-res-stages',
    );

    btnAll.addEventListener('click', () => {
        data.stages.forEach(s => state.stageFilter.add(s.num));
        setAllCb(body, true);
        updateResultsFilterCounters(data, state);
        onChange();
    });
    btnNone.addEventListener('click', () => {
        state.stageFilter.clear();
        setAllCb(body, false);
        updateResultsFilterCounters(data, state);
        onChange();
    });

    for (const st of data.stages) {
        const lbl = createElement('label', 'filter-item');
        const cb  = createElement('input') as HTMLInputElement;
        cb.type   = 'checkbox'; cb.checked = true;
        cb.dataset['stageNum'] = String(st.num);
        cb.addEventListener('change', () => {
            cb.checked ? state.stageFilter.add(st.num) : state.stageFilter.delete(st.num);
            updateResultsFilterCounters(data, state);
            onChange();
        });
        lbl.appendChild(cb);
        lbl.appendChild(createElement('span', 'filter-ss',   `SS${st.num}`));
        lbl.appendChild(createElement('span', 'filter-name', st.name));
        body.appendChild(lbl);
    }
    cont.appendChild(group);
}

function buildResultsDriverFilter(
    data:    IParsedRallyData,
    state:   IResultsFilterState,
    onChange: () => void,
    cont:    HTMLElement,
): void {
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(
        i18n.t().filterParticipants, 'counter-res-drivers',
    );
    body.dataset['filter'] = 'drivers';

    if (state.activeDriverKeys.size === 0)
        data.drivers.forEach(d => state.activeDriverKeys.add(d.username));

    function syncDriverFilter(): void {
        state.driverFilter = state.activeDriverKeys.size === data.drivers.length
            ? new Set()
            : new Set(state.activeDriverKeys);
    }

    btnAll.addEventListener('click', () => {
        data.drivers.forEach(d => state.activeDriverKeys.add(d.username));
        setAllCb(body, true);
        syncDriverFilter();
        updateResultsFilterCounters(data, state);
        onChange();
    });
    btnNone.addEventListener('click', () => {
        state.activeDriverKeys.clear();
        setAllCb(body, false);
        syncDriverFilter();
        updateResultsFilterCounters(data, state);
        onChange();
    });

    for (const drv of data.drivers) {
        const lbl = createElement('label', 'filter-item');
        const cb  = createElement('input') as HTMLInputElement;
        cb.type   = 'checkbox'; cb.checked = true;
        cb.addEventListener('change', () => {
            cb.checked
                ? state.activeDriverKeys.add(drv.username)
                : state.activeDriverKeys.delete(drv.username);
            syncDriverFilter();
            updateResultsFilterCounters(data, state);
            onChange();
        });
        const content = createElement('div', 'filter-driver-content');
        const nm = createElement('span', 'filter-driver-name',
            drv.realName && drv.realName !== drv.username
                ? `${drv.username} (${drv.realName})` : drv.username,
        );
        content.appendChild(nm);
        if (drv.car) content.appendChild(createElement('span', 'filter-driver-car', drv.car));
        lbl.appendChild(cb); lbl.appendChild(content);
        body.appendChild(lbl);
    }
    cont.appendChild(group);
}

function buildResultsGroupFilter(
    data:    IParsedRallyData,
    state:   IResultsFilterState,
    onChange: () => void,
    cont:    HTMLElement,
): void {
    const { group, body, btnAll, btnNone } = buildCollapsibleFilterGroup(
        i18n.t().filterResultsClass, 'counter-res-groups',
    );

    btnAll.addEventListener('click', () => {
        data.groups.forEach(g => state.groupFilter.add(g));
        setAllCb(body, true);
        updateResultsFilterCounters(data, state);
        onChange();
    });
    btnNone.addEventListener('click', () => {
        state.groupFilter.clear();
        setAllCb(body, false);
        updateResultsFilterCounters(data, state);
        onChange();
    });

    for (const grp of data.groups) {
        const lbl  = createElement('label', 'filter-item');
        const cb   = createElement('input') as HTMLInputElement;
        cb.type    = 'checkbox'; cb.checked = true;
        cb.addEventListener('change', () => {
            cb.checked ? state.groupFilter.add(grp) : state.groupFilter.delete(grp);
            updateResultsFilterCounters(data, state);
            onChange();
        });
        lbl.appendChild(cb);
        lbl.appendChild(createElement('span', 'filter-group-label', grp));
        body.appendChild(lbl);
    }
    cont.appendChild(group);
}

function wireApplyButton(onApply: (selected: Set<string>) => void): void {
    const btn = document.getElementById('btn-apply-filter');
    if (!btn) return;
    const fresh = btn.cloneNode(true) as HTMLElement;
    btn.replaceWith(fresh);
    fresh.addEventListener('click', () => {
        const selected = new Set<string>(
            qsa<HTMLElement>('#results-tbody tr.row-selected')
                .map(r => r.dataset['username']!)
                .filter(Boolean),
        );
        onApply(selected);
    });
}

function setAllCb(body: HTMLElement, value: boolean): void {
    qsa<HTMLInputElement>('input[type=checkbox]', body).forEach(cb => { cb.checked = value; });
}

function setCounter(id: string, current: number, total: number): void {
    const el = document.getElementById(id);
    if (el) el.textContent = `(${current}/${total})`;
}
