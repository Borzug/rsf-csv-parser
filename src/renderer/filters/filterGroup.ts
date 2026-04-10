import { createElement } from '../dom';

export interface IFilterGroupRefs {
    group:   HTMLElement;
    body:    HTMLElement;
    btnAll:  HTMLButtonElement;
    btnNone: HTMLButtonElement;
}

export function buildCollapsibleFilterGroup(
    title: string,
    counterId: string,
): IFilterGroupRefs {
    const group = createElement('div', 'filter-group collapsed');

    const hdr  = createElement('div', 'filter-header');
    const left = createElement('div', 'filter-header-left');
    left.innerHTML = `<span class="collapse-icon">▶</span>`
        + `<span class="filter-title">${title}</span>`
        + `<span class="filter-counter" id="${counterId}"></span>`;

    const right   = createElement('div', 'filter-header-right');
    const btnAll  = createElement('button', 'btn-fa', 'Все');
    const btnNone = createElement('button', 'btn-fa', 'Никого');
    right.appendChild(btnAll);
    right.appendChild(btnNone);

    hdr.appendChild(left);
    hdr.appendChild(right);

    const body = createElement('div', 'filter-body');

    left.addEventListener('click', () => group.classList.toggle('collapsed'));
    btnAll.addEventListener('click',  e => e.stopPropagation());
    btnNone.addEventListener('click', e => e.stopPropagation());

    group.appendChild(hdr);
    group.appendChild(body);

    return { group, body, btnAll, btnNone };
}
