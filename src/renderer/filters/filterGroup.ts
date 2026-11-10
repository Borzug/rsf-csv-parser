import { i18n } from "../../i18n/index.js";
import { createElement } from "../dom.js";

export interface IFilterGroupRefs {
    group:   HTMLElement;
    body:    HTMLElement;
    btnAll:  HTMLButtonElement;
    btnNone: HTMLButtonElement;
}

/** Сколько участников у каждого значения (класса, машины, страны). */
export function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const it of items) counts.set(key(it), (counts.get(key(it)) ?? 0) + 1);
    return counts;
}

/** Число участников справа в пункте фильтра. */
export function createFilterCount(n: number): HTMLElement {
    return createElement('span', 'filter-count', String(n));
}

/**
 * Раскрытые группы (по id счётчика). Панели перестраиваются при смене языка и файла —
 * раскрытое пользователем остаётся раскрытым.
 */
const expandedGroups = new Set<string>();

export function buildCollapsibleFilterGroup(
    title:     string,
    counterId: string,
): IFilterGroupRefs {
    const t = i18n.t();
    const expanded = expandedGroups.has(counterId);

    const group = createElement('div', expanded ? 'filter-group' : 'filter-group collapsed');

    const hdr  = createElement('div', 'filter-header');
    // Кнопка — чтобы группу можно было раскрыть с клавиатуры и скринридер знал её состояние
    const left = createElement('button', 'filter-header-left');
    left.type = 'button';
    left.setAttribute('aria-expanded', String(expanded));
    const icon = createElement('span', 'collapse-icon', '▶');
    icon.setAttribute('aria-hidden', 'true');
    const counter = createElement('span', 'filter-counter');
    counter.id = counterId;
    left.appendChild(icon);
    left.appendChild(createElement('span', 'filter-title', title));
    left.appendChild(counter);

    const right   = createElement('div', 'filter-header-right');
    const btnAll  = createElement('button', 'btn-fa', t.filterAll);
    const btnNone = createElement('button', 'btn-fa', t.filterNone);
    right.appendChild(btnAll);
    right.appendChild(btnNone);

    hdr.appendChild(left);
    hdr.appendChild(right);

    const body = createElement('div', 'filter-body');

    left.addEventListener('click', () => {
        const collapsed = group.classList.toggle('collapsed');
        left.setAttribute('aria-expanded', String(!collapsed));
        collapsed ? expandedGroups.delete(counterId) : expandedGroups.add(counterId);
    });
    btnAll.addEventListener('click',  e => e.stopPropagation());
    btnNone.addEventListener('click', e => e.stopPropagation());

    group.appendChild(hdr);
    group.appendChild(body);

    return { group, body, btnAll, btnNone };
}
