import type { IStageInfo } from '../../shared/types.js';
import { i18n } from "../../i18n/index.js";
import {
    escapeHtml,
    formatTime,
    formatTimeSigned
} from "../utils.js";
import type { TYMode } from "./controller.js";
import { splitOfPoint, stageIdxOfPoint } from "./points";

const TOOLTIP_MARGIN_PX = 16;
const TOOLTIP_OFFSET_Y  = 12;

export function buildTooltipHandler(
    getStages:     () => IStageInfo[],
    getChart:      () => any,
    getPinnedIdxs: () => number[],
    getYMode:      () => TYMode,
): (ctx: any) => void {
    return function handler(context: any): void {
        const el      = document.getElementById('chart-tooltip')!;
        const tooltip = context.tooltip;

        if (tooltip.opacity === 0) { el.style.display = 'none'; return; }

        const dp = tooltip.dataPoints?.[0];
        if (!dp) { el.style.display = 'none'; return; }

        const pinnedIdxs = getPinnedIdxs();
        const yMode      = getYMode();
        const onPinned   = pinnedIdxs.includes(dp.datasetIndex);
        // В режиме «от выбранного» подсказка нужна и для остальных линий — ради отставания от базы
        const fieldTips  = yMode === 'pinned';
        if (pinnedIdxs.length && !onPinned && !fieldTips) {
            el.style.display = 'none';
            return;
        }

        const xIdx      = dp.dataIndex as number;
        const y0        = dp.raw as number | null;
        const chart     = getChart();
        const stageInfo = resolveStageFromIndex(xIdx, getStages());

        el.innerHTML = pinnedIdxs.length > 1 && onPinned
            ? buildCompareHtml(chart, pinnedIdxs, xIdx, stageInfo)
            : buildTooltipHtml(
                collectMatchingDatasets(chart, xIdx, y0, fieldTips ? [] : pinnedIdxs),
                xIdx, stageInfo, yMode,
                yMode === 'position' ? leaderAbsAt(chart, xIdx) : null,
            );
        el.style.display = 'block';

        positionTooltip(el, context, TOOLTIP_MARGIN_PX, TOOLTIP_OFFSET_Y);
    };
}

interface IDatasetMatch {
    ds:    any;
    y:     number | null;
    isDnf: boolean;
}

function collectMatchingDatasets(
    chart:      any,
    xIdx:       number,
    y0:         number | null,
    pinnedIdxs: number[],
): IDatasetMatch[] {
    const matches: IDatasetMatch[] = [];
    if (!chart || y0 === null) return matches;

    chart.data.datasets.forEach((ds: any, di: number) => {
        if (ds.hidden) return;
        if (pinnedIdxs.length && !pinnedIdxs.includes(di)) return;
        const yv    = ds.data[xIdx] as number | null;
        // Последняя пройденная точка участника, сошедшего с комментарием
        const isDnf = xIdx === (ds._dnfCmtPtIdx as number | null);
        if (yv !== null && Math.abs(yv - y0) < 1.0) matches.push({ ds, y: yv, isDnf });
    });

    return matches;
}

/** Сравнение нескольких закреплённых участников в одной точке сплита. */
function buildCompareHtml(
    chart:      any,
    pinnedIdxs: number[],
    xIdx:       number,
    stageInfo:  { label: string } | null,
): string {
    const rows = pinnedIdxs
        .map(di => chart.data.datasets[di])
        .filter((ds: any) => ds && !ds.hidden)
        .map((ds: any) => ({ ds, abs: (ds._abs as (number | null)[])[xIdx] ?? null }))
        .sort((a: any, b: any) => {
            if (a.abs === null) return 1;
            if (b.abs === null) return -1;
            return a.abs - b.abs;
        });
    const best = rows[0]?.abs ?? null;

    let html = '<div class="tt-block">';
    if (stageInfo) html += `<span class="tt-stage">${escapeHtml(stageInfo.label)}</span>`;
    html += '<table class="tt-compare">';
    rows.forEach(({ ds, abs }: any, i: number) => {
        const name  = escapeHtml((ds._displayName as string) || (ds.driverKey as string));
        const delta = abs === null ? ''
            : i === 0 ? '' : formatTimeSigned(abs - (best as number));
        html += '<tr>'
            + `<td><span class="tt-dot" style="background:${ds.borderColor}"></span>${name}</td>`
            + `<td class="tt-num">${abs === null ? '<span class="tt-red">DNF</span>' : formatTime(abs)}</td>`
            + `<td class="tt-num tt-delta">${delta}</td>`
            + '</tr>';
    });
    html += '</table></div>';
    return html;
}

/** Лучшее накопленное время среди показанных участников в точке сплита. */
function leaderAbsAt(chart: any, xIdx: number): number | null {
    let best: number | null = null;
    for (const ds of chart?.data.datasets ?? []) {
        if (ds.hidden) continue;
        const v = (ds._abs as (number | null)[])[xIdx];
        if (v !== null && v !== undefined && (best === null || v < best)) best = v;
    }
    return best;
}

function buildTooltipHtml(
    matches:   IDatasetMatch[],
    xIdx:      number,
    stageInfo: { label: string } | null,
    yMode:     TYMode,
    leaderAbs: number | null,
): string {
    const t = i18n.t();

    return matches.map(({ ds, y, isDnf }, mi) => {
        const divider = mi > 0 ? '<div class="tt-divider"></div>' : '';
        const name    = escapeHtml((ds._displayName as string) || (ds.driverKey as string));
        const car     = escapeHtml(ds._car as string ?? '');
        const pen     = (ds._cumPen as number[])[xIdx] ?? 0;
        const sp      = (ds._cumSP  as number[])[xIdx] ?? 0;
        const sr      = (ds._cumSR  as number[])[xIdx] ?? 0;
        const cmt     = (ds._cmts   as string[])[xIdx]  ?? '';

        let html = `${divider}<div class="tt-block">`;
        if (stageInfo) html += `<span class="tt-stage">${escapeHtml(stageInfo.label)}</span>`;
        html += `<span class="tt-name">${name}</span>`;
        if (car) html += `<span class="tt-car">🚗 ${car}</span>`;
        html += `<span class="tt-sep"></span>`;
        const abs = (ds._abs as (number | null)[])[xIdx] ?? null;
        // Время точки схода настоящее (последний сплит) — показываем его и помечаем сход
        html += abs === null
            ? `<span class="tt-red">DNF</span>`
            : `<span class="tt-row">⏱ ${formatTime(abs)}</span>`;
        if (isDnf && abs !== null) html += `<span class="tt-red">DNF</span>`;
        if (y !== null && yMode === 'position') {
            html += `<span class="tt-row">${t.tooltipPosition}: ${y}</span>`;
            if (abs !== null && leaderAbs !== null && abs > leaderAbs)
                html += `<span class="tt-row">${t.tooltipGapLeader}: ${formatTimeSigned(abs - leaderAbs)}</span>`;
        } else if (y !== null && yMode !== 'abs')
            html += `<span class="tt-row">${yMode === 'leader' ? t.tooltipGapLeader : t.tooltipGapPinned}: ${formatTimeSigned(y)}</span>`;
        if (pen > 0) html += `<span class="tt-red">${t.tooltipPenalty}: +${formatTime(pen)}</span>`;
        if (sp  > 0) html += `<span class="tt-red">${t.tooltipServicePenalty}: +${formatTime(sp)}</span>`;
        if (sr  > 0) html += `<span class="tt-red">${t.tooltipSuperRally}: ${sr}×</span>`;
        if (cmt)     html += `<span class="tt-sep"></span><span class="tt-cmt">💬 ${escapeHtml(cmt)}</span>`;
        html += '</div>';
        return html;
    }).join('');
}

function resolveStageFromIndex(
    idx:    number,
    stages: IStageInfo[],
): { label: string } | null {
    if (idx === 0) return null;
    const si    = stageIdxOfPoint(idx);
    const split = splitOfPoint(idx);
    const stage = stages[si];
    if (!stage) return null;
    const suffix = split === 1 ? ' · SP1' : split === 2 ? ' · SP2' : '';
    return { label: `SS${stage.num} ${stage.name}${suffix}` };
}

/** Подсказка не подходит к краю окна ближе этого */
const VIEW_EDGE = 10;

function positionTooltip(
    el:       HTMLElement,
    context:  any,
    marginPx: number,
    offsetY:  number,
): void {
    const rect = context.chart.canvas.getBoundingClientRect();
    let tx = rect.left + context.tooltip.caretX + marginPx;
    let ty = rect.top  + context.tooltip.caretY - offsetY;
    el.style.left = `${tx}px`;
    el.style.top  = `${ty}px`;

    requestAnimationFrame(() => {
        const tr = el.getBoundingClientRect();
        if (tr.right  > window.innerWidth  - VIEW_EDGE) tx = rect.left + context.tooltip.caretX - tr.width  - marginPx;
        if (tr.bottom > window.innerHeight - VIEW_EDGE) ty = rect.top  + context.tooltip.caretY - tr.height;
        el.style.left = `${tx}px`;
        el.style.top  = `${ty}px`;
    });
}
