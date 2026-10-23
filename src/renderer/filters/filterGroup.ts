import { i18n } from "../../i18n/index.js";
import { createElement } from "../dom.js";

export interface IFilterGroupRefs {
    group:   HTMLElement;
    body:    HTMLElement;
    btnAll:  HTMLButtonElement;
    btnNone: HTMLButtonElement;
}

export function buildCollapsibleFilterGroup(
    title:     string,
    counterId: string,
): IFilterGroupRefs {
    const t = i18n.t();

    const group = createElement('div', 'filter-group collapsed');

    const hdr  = createElement('div', 'filter-header');
    // Кнопка — чтобы группу можно было раскрыть с клавиатуры и скринридер знал её состояние
    const left = createElement('button', 'filter-header-left');
    left.type = 'button';
    left.setAttribute('aria-expanded', 'false');
    left.innerHTML = `<span class="collapse-icon" aria-hidden="true">▶</span>`
        + `<span class="filter-title">${title}</span>`
        + `<span class="filter-counter" id="${counterId}"></span>`;

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
    });
    btnAll.addEventListener('click',  e => e.stopPropagation());
    btnNone.addEventListener('click', e => e.stopPropagation());

    group.appendChild(hdr);
    group.appendChild(body);

    return { group, body, btnAll, btnNone };
}
