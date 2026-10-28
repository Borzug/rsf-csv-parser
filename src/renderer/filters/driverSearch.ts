import { i18n } from "../../i18n/index.js";
import { qsa } from "../dom.js";

const DEBOUNCE_MS = 200;
const MIN_CHARS   = 2;

let _searchTimer: number | null = null;

/**
 * Поиск только помогает найти строку: прячет несовпавшие классом .search-hidden и не
 * меняет style.display, которым список сужают фильтры класса/машины/СУ. Поэтому
 * «Все»/«Ничего», пресеты и счётчик (state.visibleDriverKeys) поиска не учитывают —
 * иначе «Ничего» при активном поиске снимало бы отметку только с найденных.
 */
export function applyDriverSearch(q: string, body: HTMLElement): void {
    const s = q.trim().toLowerCase();
    qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
        const miss = s.length >= MIN_CHARS && !(item.textContent ?? '').toLowerCase().includes(s);
        item.classList.toggle('search-hidden', miss);
    });
}

/** Повторно применяет поиск после перестройки или фильтрации списка. */
export function reapplyDriverSearch(body: HTMLElement): void {
    const sv = (document.getElementById('driver-search-input') as HTMLInputElement | null)
        ?.value ?? '';
    applyDriverSearch(sv, body);
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
