import type { IParsedRallyData } from '../../shared/types.js';
import { i18n } from "../../i18n/index.js";
import { qsa } from "../dom.js";
import {
    IChartFilterState,
    refreshVisibleDriverKeys
} from "./filterState";

const DEBOUNCE_MS = 200;
const MIN_CHARS   = 2;

let _searchTimer: number | null = null;

export function applyDriverSearch(
    q:     string,
    body:  HTMLElement,
    data:  IParsedRallyData,
    state: IChartFilterState,
): void {
    const s = q.trim().toLowerCase();
    qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
        const grp   = item.dataset['group'] ?? '';
        const car   = item.dataset['car']   ?? '';
        const grpOk = !data.groups.length || state.activeGroups.has(grp);
        const carOk = !state.activeCars.size || state.activeCars.has(car);
        if (!grpOk || !carOk) { item.style.display = 'none'; return; }
        if (s.length < MIN_CHARS) { item.style.display = ''; return; }
        item.style.display = (item.textContent ?? '').toLowerCase().includes(s) ? '' : 'none';
    });
    refreshVisibleDriverKeys(body, state);
}

export function reapplyDriverSearch(body: HTMLElement): void {
    const sv = (document.getElementById('driver-search-input') as HTMLInputElement | null)
        ?.value ?? '';
    if (sv.length < MIN_CHARS) return;
    const q = sv.toLowerCase();
    qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
        if (item.style.display !== 'none'
            && !(item.textContent ?? '').toLowerCase().includes(q))
            item.style.display = 'none';
    });
}

export function buildSearchBox(
    body:     HTMLElement,
    onSearch: (q: string) => void,
): void {
    const sw = document.createElement('div');
    sw.className = 'filter-search-wrap';

    const si = document.createElement('input');
    si.className   = 'filter-search';
    si.type        = 'text';
    si.id          = 'driver-search-input';
    si.placeholder = i18n.t().filterSearch;

    const sc = document.createElement('button');
    sc.className   = 'filter-search-clear hidden';
    sc.textContent = '×';

    sw.appendChild(si);
    sw.appendChild(sc);
    body.appendChild(sw);

    si.addEventListener('input', () => {
        sc.classList.toggle('hidden', si.value.length === 0);
        if (_searchTimer !== null) clearTimeout(_searchTimer);
        _searchTimer = setTimeout(
            () => onSearch(si.value),
            DEBOUNCE_MS,
        ) as unknown as number;
    });

    sc.addEventListener('click', () => {
        si.value = '';
        sc.classList.add('hidden');
        onSearch('');
    });
}
