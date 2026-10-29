import { i18n } from "../../i18n/index.js";
import { qsa } from "../dom.js";
import { debounce, SEARCH_DEBOUNCE_MS } from "../utils";

const MIN_CHARS   = 2;

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
    // Поле поиска — внутри того же списка: на графике и в результатах у каждого своё
    const sv = body.querySelector<HTMLInputElement>('.filter-search')?.value ?? '';
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
    si.placeholder = i18n.t().filterSearch;

    const sc = document.createElement('button');
    sc.className   = 'filter-search-clear hidden';
    sc.textContent = '×';

    sw.appendChild(si);
    sw.appendChild(sc);
    body.appendChild(sw);

    const search = debounce(onSearch, SEARCH_DEBOUNCE_MS);
    si.addEventListener('input', () => {
        sc.classList.toggle('hidden', si.value.length === 0);
        search(si.value);
    });

    sc.addEventListener('click', () => {
        si.value = '';
        sc.classList.add('hidden');
        onSearch('');
    });
}
