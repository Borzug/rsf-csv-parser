import type { IParsedRallyData, IStageInfo } from '../../shared/types';
import { driverColor } from "../colors";
import { createElement } from "../dom";

export interface ILegendPanelCallbacks {
    onDriverHover: (key: string | null) => void;
    onDriverClick: (key: string) => void;
}

export function updateLegendPanel(
    data:             IParsedRallyData,
    chart:            any,
    activeStages:     IStageInfo[],
    recordMap:        Map<string, Map<number, any>>,
    activeDriverKeys: Set<string>,
    activeGroups:     Set<string>,
    activeCars:       Set<string>,
    isExpanded:       boolean,
    pinnedDriverKey:  string | null = null,
    callbacks?:       ILegendPanelCallbacks,
): void {
    const panel     = document.getElementById('legend-panel')!;
    const itemsEl   = document.getElementById('legend-items')!;
    const expandBtn = document.getElementById('legend-expand-btn') as HTMLButtonElement;

    panel.style.display = '';

    const visibleWithTime = buildSortedVisibleDrivers(data, chart, activeStages, recordMap);
    renderLegendItems(itemsEl, visibleWithTime, data, pinnedDriverKey, callbacks);

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
            if (!r || r.time1 === null) { cum = null; break; }
            cum! += r.time3 ?? 0;
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
    pinnedDriverKey: string | null,
    callbacks?:      ILegendPanelCallbacks,
): void {
    container.innerHTML = '';
    items.forEach(({ drv }) => {
        const gi    = data.drivers.indexOf(drv);
        const color = driverColor(gi);
        const item  = createElement('div', 'legend-item') as HTMLElement;
        item.dataset['driverKey'] = drv.username;
        item.style.cursor = 'pointer';
        if (drv.username === pinnedDriverKey) item.classList.add('pinned-highlight');

        const dot = createElement('span', 'legend-dot') as HTMLElement;
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
            item.addEventListener('click', () => {
                callbacks.onDriverClick(drv.username);
            });
        }

        container.appendChild(item);
    });
}
