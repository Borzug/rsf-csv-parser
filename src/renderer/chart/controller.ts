import type { IParsedRallyData, IStageInfo } from '../../shared/types';
import {
    computeYAxisStep,
    formatYAxisTick
} from "../utils";
import { buildDatasets } from "./datasets";
import { buildDnfLinePlugin } from "./pluginDnfLine";
import { buildHoverDimPlugin } from "./pluginHoverDim";
import { buildPinnedCommentsPlugin } from "./pluginPinnedComments";
import { buildStageNamesPlugin } from "./pluginStageNames";
import { buildTooltipHandler } from "./tooltip";

const HOVER_DIST_PX  = 40;
const ROTATE_45_AT   = 9;
const ROTATE_90_AT   = 20;
const BOT_PAD_NORMAL = 46;
const BOT_PAD_45     = 90;
const BOT_PAD_90     = 110;

export interface IChartController {
    build(
        data:             IParsedRallyData,
        stages:           IStageInfo[],
        recordMap:        Map<string, Map<number, any>>,
        cumPenMap:        Map<string, Map<number, number>>,
        cumSPMap:         Map<string, Map<number, number>>,
        cumSRMap:         Map<string, Map<number, number>>,
        activeDriverKeys: Set<string>,
        activeGroups:     Set<string>,
        activeCars:       Set<string>,
    ): void;
    destroy(): void;
    updateDatasetVisibility(
        data:             IParsedRallyData,
        activeDriverKeys: Set<string>,
        activeGroups:     Set<string>,
        activeCars:       Set<string>,
    ): void;
    pinDriver(datasetIndex: number | null): void;
    setHoveredKey(key: string | null): void;
    setOnPinChange(cb: (key: string | null) => void): void;
    getPinnedIndex(): number | null;
    getPinnedDriverKey(): string | null;
    getActiveStages(): IStageInfo[];
    getChart(): any;
}

export function createChartController(): IChartController {
    let chart:              any           = null;
    let canvas:             HTMLCanvasElement | null = null;
    let hoveredDsIdx:       number | null = null;
    let hoveredDsKey:       string | null = null;
    let pinnedDsIdx:        number | null = null;
    let hoveredBandIdx:     number | null = null;
    let activeStages:       IStageInfo[]  = [];
    let currentBotPad       = BOT_PAD_NORMAL;

    let clickHandler:       ((e: MouseEvent) => void) | null = null;
    let mousemoveHandler:   ((e: MouseEvent) => void) | null = null;
    let mouseleaveHandler:  (() => void)              | null = null;
    let onPinChange:        ((key: string | null) => void) | null = null;

    function removeCanvasListeners(): void {
        if (!canvas) return;
        if (clickHandler)     canvas.removeEventListener('click',      clickHandler);
        if (mousemoveHandler) canvas.removeEventListener('mousemove',  mousemoveHandler);
        if (mouseleaveHandler) canvas.removeEventListener('mouseleave', mouseleaveHandler);
        clickHandler = mousemoveHandler = mouseleaveHandler = null;
    }

    return {
        getChart:           () => chart,
        getPinnedIndex:     () => pinnedDsIdx,
        getPinnedDriverKey: () => {
            if (pinnedDsIdx === null || !chart) return null;
            return chart.data.datasets[pinnedDsIdx]?.driverKey ?? null;
        },
        getActiveStages:    () => activeStages,

        setHoveredKey(key: string | null): void {
            hoveredDsKey = key;
            chart?.update('none');
        },

        setOnPinChange(cb: (key: string | null) => void): void {
            onPinChange = cb;
        },

        destroy(): void {
            removeCanvasListeners();
            if (chart) { chart.destroy(); chart = null; }
            hoveredDsIdx  = null;
            pinnedDsIdx   = null;
            hoveredBandIdx = null;
        },

        pinDriver(idx: number | null): void {
            pinnedDsIdx = idx;
            chart?.update('none');
        },

        updateDatasetVisibility(data, activeDriverKeys, activeGroups, activeCars): void {
            if (!chart || !data) return;
            chart.data.datasets.forEach((ds: any) => {
                const drv   = data.drivers.find(d => d.username === ds.driverKey);
                const grpOk = !data.groups.length || !drv || activeGroups.has(drv.group);
                const carOk = !activeCars.size || !drv || activeCars.has(drv.car);
                ds.hidden   = !activeDriverKeys.has(ds.driverKey) || !grpOk || !carOk;
            });
            chart.update('none');
        },

        build(data, stages, recordMap, cumPenMap, cumSPMap, cumSRMap,
              activeDriverKeys, activeGroups, activeCars): void {
            activeStages = stages;
            const useRot45 = stages.length > ROTATE_45_AT && stages.length <= ROTATE_90_AT;
            const useRot90 = stages.length > ROTATE_90_AT;
            currentBotPad  = useRot90 ? BOT_PAD_90 : useRot45 ? BOT_PAD_45 : BOT_PAD_NORMAL;

            const nPts   = 1 + stages.length * 3;
            const labels = new Array<string>(nPts).fill('');
            const maxCum = computeMaxCumulative(data, stages, recordMap);
            const yStep  = computeYAxisStep(maxCum);

            const datasets = buildDatasets(
                data, stages, recordMap, cumPenMap, cumSPMap, cumSRMap,
                activeDriverKeys, activeGroups, activeCars,
            );

            canvas = document.getElementById('race-chart') as HTMLCanvasElement;
            removeCanvasListeners();
            if (chart) { chart.destroy(); chart = null; hoveredDsIdx = null; pinnedDsIdx = null; }

            const Chart = (window as any).Chart;
            chart = new Chart(canvas, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    normalized: true,
                    interaction: { mode: 'nearest', axis: 'xy', intersect: false },
                    layout: { padding: { bottom: currentBotPad } },
                    onHover: (event: any, elements: any[]) => {
                        if (pinnedDsIdx !== null) { hoveredDsIdx = null; return; }
                        let newIdx: number | null = null;
                        if (elements.length && event.native) {
                            const el   = elements[0];
                            const meta = chart.getDatasetMeta(el.datasetIndex);
                            const pt   = meta.data[el.index];
                            if (pt && Math.hypot(pt.x - (event.x ?? 0), pt.y - (event.y ?? 0)) <= HOVER_DIST_PX)
                                newIdx = el.datasetIndex;
                        }
                        if (newIdx !== hoveredDsIdx) { hoveredDsIdx = newIdx; chart.update('none'); }
                    },
                    plugins: {
                        legend:  { display: false },
                        tooltip: {
                            enabled:  false,
                            external: buildTooltipHandler(
                                stages,
                                () => chart,
                                () => pinnedDsIdx,
                            ),
                        },
                    },
                    scales: buildScales(yStep),
                },
                plugins: [
                    buildHoverDimPlugin(
                        () => hoveredDsKey,
                        () => pinnedDsIdx,
                        () => hoveredDsIdx,
                    ),
                    buildStageNamesPlugin(stages, useRot45, useRot90, () => hoveredBandIdx),
                    buildDnfLinePlugin(() => hoveredDsKey, () => pinnedDsIdx, () => hoveredDsIdx),
                    buildPinnedCommentsPlugin(() => pinnedDsIdx),
                ],
            });

            clickHandler = (e: MouseEvent) =>
                handleCanvasClick(e, chart, canvas!, stages, currentBotPad, pinnedDsIdx,
                    (idx) => {
                        pinnedDsIdx = idx;
                        chart.update('none');
                        const key = chart.data.datasets[idx]?.driverKey ?? null;
                        onPinChange?.(key);
                    },
                    () => {
                        pinnedDsIdx = null;
                        chart.update('none');
                        onPinChange?.(null);
                    },
                );

            mousemoveHandler = (e: MouseEvent) => {
                const newBandIdx = resolveHoveredBandIdx(e, chart, canvas!, stages, currentBotPad);
                canvas!.style.cursor = newBandIdx !== null ? 'pointer' : '';
                if (newBandIdx !== hoveredBandIdx) {
                    hoveredBandIdx = newBandIdx;
                    chart.update('none');
                }
            };

            mouseleaveHandler = () => {
                document.getElementById('chart-tooltip')!.style.display = 'none';
                if (hoveredDsIdx !== null)  { hoveredDsIdx  = null; chart?.update('none'); }
                if (hoveredBandIdx !== null) {
                    hoveredBandIdx = null;
                    canvas!.style.cursor = '';
                    chart?.update('none');
                }
            };

            canvas.addEventListener('click',      clickHandler);
            canvas.addEventListener('mousemove',  mousemoveHandler);
            canvas.addEventListener('mouseleave', mouseleaveHandler);
        },
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveHoveredBandIdx(
    e:      MouseEvent,
    chart:  any,
    canvas: HTMLCanvasElement,
    stages: IStageInfo[],
    botPad: number,
): number | null {
    if (!chart) return null;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const ca   = chart.chartArea;

    if (my <= ca.bottom + 1 || my >= ca.bottom + 1 + botPad) return null;

    const xs = chart.scales.x;
    for (let i = 0; i < stages.length; i++) {
        const xL = xs.getPixelForTick(i * 3);
        const xR = xs.getPixelForTick(i * 3 + 3);
        if (mx >= xL && mx <= xR) return i;
    }
    return null;
}

function computeMaxCumulative(
    data:      IParsedRallyData,
    stages:    IStageInfo[],
    recordMap: Map<string, Map<number, any>>,
): number {
    let max = 0;
    for (const drv of data.drivers) {
        let cum = 0;
        for (const st of stages) {
            const r = recordMap.get(drv.username)?.get(st.num);
            if (!r || r.time1 === null) break;
            cum += (r.time1 ?? 0) + (r.time2 ?? 0) + (r.time3 ?? 0);
        }
        if (cum > max) max = cum;
    }
    return max;
}

function buildScales(yStep: number): object {
    return {
        x: {
            type: 'category',
            ticks: { display: false },
            grid: {
                drawTicks: false,
                color:     (ctx: any) => (ctx.index > 0 && ctx.index % 3 === 0) ? '#2a2a2a' : '#1a1a1a',
                lineWidth: (ctx: any) => (ctx.index > 0 && ctx.index % 3 === 0) ? 1.5 : 0.5,
            },
            border: { color: '#3a3a3a' },
        },
        y: {
            type: 'linear',
            min:  0,
            ticks: {
                color:    '#555',
                font:     { size: 11, family: "'Fira Code', monospace" },
                stepSize: yStep,
                callback: (v: any) => formatYAxisTick(v as number),
            },
            grid:  { color: '#1c1c1c', lineWidth: 1 },
            border:{ color: '#3a3a3a' },
            title: {
                display: true,
                text:    'Время',
                color:   '#3c3c3c',
                font:    { size: 11, family: "'Fira Code', monospace" },
            },
        },
    };
}

function handleCanvasClick(
    e:         MouseEvent,
    chart:     any,
    canvas:    HTMLCanvasElement,
    stages:    IStageInfo[],
    botPad:    number,
    pinnedIdx: number | null,
    setPin:    (idx: number) => void,
    clearPin:  () => void,
): void {
    if (!chart) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const ca   = chart.chartArea;

    if (my > ca.bottom + 1 && my < ca.bottom + 1 + botPad) {
        const xs = chart.scales.x;
        for (let i = 0; i < stages.length; i++) {
            const xL = xs.getPixelForTick(i * 3);
            const xR = xs.getPixelForTick(i * 3 + 3);
            if (mx >= xL && mx <= xR) {
                (window as any).__onStageBandClick?.(stages[i].num);
                return;
            }
        }
        return;
    }

    if (my < ca.top || my > ca.bottom) return;

    const elems = chart.getElementsAtEventForMode(e, 'nearest', { intersect: false }, false) as any[];
    if (!elems.length) { if (pinnedIdx !== null) clearPin(); return; }

    const el   = elems[0];
    const meta = chart.getDatasetMeta(el.datasetIndex);
    const pt   = meta.data[el.index];
    if (!pt || Math.hypot(pt.x - mx, pt.y - my) > HOVER_DIST_PX) {
        if (pinnedIdx !== null) clearPin();
        return;
    }

    pinnedIdx === el.datasetIndex ? clearPin() : setPin(el.datasetIndex);
}
