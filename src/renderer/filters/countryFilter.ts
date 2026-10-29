import type { IParsedRallyData } from '../../shared/types';
import { createElement } from '../dom';
import { countryName, prependFlag } from '../flags';

/**
 * Пункты фильтра по стране: флаг, название на языке интерфейса и число участников.
 * Порядок — по названию, «страна не указана» в конце. Общий для графика и результатов.
 */
export function buildCountryItems(
    data:      IParsedRallyData,
    body:      HTMLElement,
    isChecked: (code: string) => boolean,
    onToggle:  (code: string, checked: boolean) => void,
): void {
    const counts = new Map<string, number>();
    for (const d of data.drivers) counts.set(d.country, (counts.get(d.country) ?? 0) + 1);

    const items = data.countries
        .map(code => ({ code, name: countryName(code) }))
        .sort((a, b) => (a.code ? 0 : 1) - (b.code ? 0 : 1) || a.name.localeCompare(b.name));

    for (const { code, name } of items) {
        const lbl = createElement('label', 'filter-item');
        const cb  = createElement('input') as HTMLInputElement;
        cb.type    = 'checkbox';
        cb.checked = isChecked(code);
        cb.addEventListener('change', () => onToggle(code, cb.checked));

        const label = createElement('span', 'filter-country-label', name);
        prependFlag(label, code);
        lbl.appendChild(cb);
        lbl.appendChild(label);
        lbl.appendChild(createElement('span', 'filter-country-count', String(counts.get(code) ?? 0)));
        body.appendChild(lbl);
    }
}
