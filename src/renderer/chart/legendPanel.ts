import type { IParsedRallyData, IStageInfo } from '../../shared/types';
import { driverColor } from "../colors";
import { createElement } from "../dom";
import { isCoarsePointer } from "../utils";

export interface ILegendPanelCallbacks {
    onDriverHover: (key: string | null) => void;
    onDriverClick: (key: string, additive: boolean) => void;
}

export function updateLegendPanel(
    data:             IParsedRallyData,
    chart:            any,
    activeStages:     IStageInfo[],
    recordMap:        Map<string, Map<number, any>>,
    isExpanded:       boolean,
    pinnedKeys:       string[],
    leaderFirst:      boolean,
    callbacks?:       ILegendPanelCallbacks,
): void {
    const panel     = document.getElementById('legend-panel')!;
    const itemsEl   = document.getElementById('legend-items')!;
    const expandBtn = document.getElementById('legend-expand-btn') as HTMLButtonElement;

    // Видимость панели задаёт только переключатель вкладок (switchTab): легенда
    // обновляется и на других вкладках (смена языка, закрепление), но показываться там не должна

    const visibleWithTime = buildSortedVisibleDrivers(data, chart, activeStages, recordMap);
    // Порядок легенды повторяет порядок линий на графике сверху вниз
    if (leaderFirst) visibleWithTime.reverse();

    currentCallbacks = callbacks;
    bindLegendEvents(itemsEl);
    // Тот же список в том же порядке (закрепление, смена языка) — меняем только отметки,
    // а не пересоздаём сотни кнопок
    const order = visibleWithTime.map(v => v.drv.username).join('\n');
    if (data === renderedData && order === renderedOrder && itemsEl.children.length === visibleWithTime.length) {
        updatePinnedState(itemsEl, pinnedKeys);
    } else {
        renderLegendItems(itemsEl, visibleWithTime, data, pinnedKeys);
        renderedData  = data;
        renderedOrder = order;
    }

    panel.classList.toggle('expanded', isExpanded);
    expandBtn.textContent = isExpanded ? '›' : '‹';

    const inner = document.getElementById('legend-inner')!;
    requestAnimationFrame(() => {
        const overflows = inner.scrollHeight > inner.clientHeight + 2;
        expandBtn.style.display = (overflows || isExpanded) ? '' : 'none';
    });
}

function buildSortedVisibleDrivers(
    data:         IParsedRallyData,
    chart:        any,
    activeStages: IStageInfo[],
    recordMap:    Map<string, Map<number, any>>,
): Array<{ drv: any; cum: number | null }> {
    const dsByKey = new Map<string, any>();
    for (const ds of chart?.data.datasets ?? []) dsByKey.set(ds.driverKey, ds);
    const visibleDrvs = data.drivers.filter(drv => {
        const ds = dsByKey.get(drv.username);
        return ds && !ds.hidden;
    });

    const withTime = visibleDrvs.map(drv => {
        let cum: number | null = 0;
        for (const st of activeStages) {
            const r = recordMap.get(drv.username)?.get(st.num);
            // Сход на СУ (нет финишного времени) — тоже DNF, иначе неполное время ставит его в лидеры
            if (!r || r.time3 === null) { cum = null; break; }
            cum! += r.time3;
        }
        return { drv, cum };
    });

    withTime.sort((a, b) => {
        if (a.cum === null && b.cum === null) return 0;
        if (a.cum === null) return -1;
        if (b.cum === null) return 1;
        return b.cum - a.cum;
    });

    return withTime;
}

/** Порядок и данные, по которым построен текущий список кнопок. */
let renderedData:  IParsedRallyData | null = null;
let renderedOrder  = '';
let currentCallbacks: ILegendPanelCallbacks | undefined;
let boundContainer: HTMLElement | null = null;

function updatePinnedState(container: HTMLElement, pinnedKeys: string[]): void {
    for (const item of Array.from(container.children) as HTMLElement[]) {
        const pinned = pinnedKeys.includes(item.dataset['driverKey']!);
        item.setAttribute('aria-pressed', String(pinned));
        item.classList.toggle('pinned-highlight', pinned);
    }
}

/** Один набор обработчиков на весь список вместо пяти на каждую кнопку. */
function bindLegendEvents(container: HTMLElement): void {
    if (boundContainer === container) return;
    boundContainer = container;

    const itemOf = (e: Event): HTMLElement | null =>
        (e.target as HTMLElement | null)?.closest<HTMLElement>('.legend-item') ?? null;
    const keyOf  = (item: HTMLElement | null): string | null => item?.dataset['driverKey'] ?? null;

    // mouseenter/mouseleave не всплывают — используем mouseover/mouseout и отсекаем
    // переходы между элементами внутри одной кнопки
    container.addEventListener('mouseover', e => {
        const item = itemOf(e);
        if (!item || item.contains(e.relatedTarget as Node | null)) return;
        item.classList.add('legend-item-hover');
        currentCallbacks?.onDriverHover(keyOf(item));
    });
    container.addEventListener('mouseout', e => {
        const item = itemOf(e);
        if (!item || item.contains(e.relatedTarget as Node | null)) return;
        item.classList.remove('legend-item-hover');
        currentCallbacks?.onDriverHover(null);
    });
    container.addEventListener('focusin',  e => {
        const key = keyOf(itemOf(e));
        if (key) currentCallbacks?.onDriverHover(key);
    });
    container.addEventListener('focusout', e => {
        if (itemOf(e)) currentCallbacks?.onDriverHover(null);
    });
    container.addEventListener('click', e => {
        const key = keyOf(itemOf(e));
        if (!key) return;
        // На сенсорных экранах нет Ctrl/Shift — там касание в легенде всегда добавляет к сравнению
        const additive = e.ctrlKey || e.metaKey || e.shiftKey || isCoarsePointer();
        currentCallbacks?.onDriverClick(key, additive);
    });
}

function renderLegendItems(
    container:       HTMLElement,
    items:           Array<{ drv: any; cum: number | null }>,
    data:            IParsedRallyData,
    pinnedKeys:      string[],
): void {
    // Легенда перерисовывается целиком — возвращаем фокус клавиатуры на тот же пункт
    const focusedKey = (document.activeElement as HTMLElement | null)
        ?.closest<HTMLElement>('.legend-item')?.dataset['driverKey'] ?? null;
    const colorIdx = new Map(data.drivers.map((d, i) => [d, i]));
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    let focusItem: HTMLElement | null = null;
    for (const { drv } of items) {
        const color = driverColor(colorIdx.get(drv)!);
        const item  = createElement('button', 'legend-item');
        item.type = 'button';
        item.dataset['driverKey'] = drv.username;
        const pinned = pinnedKeys.includes(drv.username);
        item.setAttribute('aria-pressed', String(pinned));
        if (pinned) item.classList.add('pinned-highlight');

        const dot = createElement('span', 'legend-dot') as HTMLElement;
        dot.setAttribute('aria-hidden', 'true');
        dot.style.background = color;
        const name = createElement('span', 'legend-name',
            drv.realName && drv.realName !== drv.username
                ? `${drv.username} (${drv.realName})`
                : drv.username,
        );
        item.appendChild(dot);
        item.appendChild(name);
        frag.appendChild(item);
        if (drv.username === focusedKey) focusItem = item;
    }
    container.appendChild(frag);
    focusItem?.focus({ preventScroll: true });
}
