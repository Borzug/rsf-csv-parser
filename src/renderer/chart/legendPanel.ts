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

    panel.style.display = '';

    const visibleWithTime = buildSortedVisibleDrivers(data, chart, activeStages, recordMap);
    // Порядок легенды повторяет порядок линий на графике сверху вниз
    if (leaderFirst) visibleWithTime.reverse();
    renderLegendItems(itemsEl, visibleWithTime, data, pinnedKeys, callbacks);

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
    const visibleDrvs = data.drivers.filter(drv => {
        const ds = chart?.data.datasets.find((d: any) => d.driverKey === drv.username);
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

function renderLegendItems(
    container:       HTMLElement,
    items:           Array<{ drv: any; cum: number | null }>,
    data:            IParsedRallyData,
    pinnedKeys:      string[],
    callbacks?:      ILegendPanelCallbacks,
): void {
    // Легенда перерисовывается целиком — возвращаем фокус клавиатуры на тот же пункт
    const focusedKey = (document.activeElement as HTMLElement | null)
        ?.closest<HTMLElement>('.legend-item')?.dataset['driverKey'] ?? null;
    container.innerHTML = '';
    items.forEach(({ drv }) => {
        const gi    = data.drivers.indexOf(drv);
        const color = driverColor(gi);
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

        if (callbacks) {
            item.addEventListener('mouseenter', () => {
                callbacks.onDriverHover(drv.username);
                item.classList.add('legend-item-hover');
            });
            item.addEventListener('mouseleave', () => {
                callbacks.onDriverHover(null);
                item.classList.remove('legend-item-hover');
            });
            item.addEventListener('focus', () => callbacks.onDriverHover(drv.username));
            item.addEventListener('blur',  () => callbacks.onDriverHover(null));
            item.addEventListener('click', (e: MouseEvent) => {
                // На сенсорных экранах нет Ctrl/Shift — там касание в легенде всегда добавляет к сравнению
                const additive = e.ctrlKey || e.metaKey || e.shiftKey || isCoarsePointer();
                callbacks.onDriverClick(drv.username, additive);
            });
        }

        container.appendChild(item);
        if (drv.username === focusedKey) item.focus({ preventScroll: true });
    });
}
