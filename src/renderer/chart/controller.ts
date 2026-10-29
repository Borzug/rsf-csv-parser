import { i18n } from "../../i18n/index";
import type { IParsedRallyData, IStageInfo, TRecordMap } from '../../shared/types';
import {
    computeYAxisStep,
    formatYAxisTick
} from "../utils";
import { buildDatasets } from "./datasets";
import { passesAttrFilters } from "../filters/filterState";
import { buildHoverDimPlugin } from "./pluginHoverDim";
import {
    collectComments,
    commentSourceIdxs,
    countCommentsByStage,
    IChartComment
} from "./chartComments";
import {
    buildPinnedCommentsPlugin,
    IActiveComment
} from "./pluginPinnedComments";
import { buildPointsPlugin } from "./pluginPoints";
import {
    buildStageNamesPlugin,
    COMMENT_ROW_H,
    ROTATE_45_AT,
    ROTATE_90_AT
} from "./pluginStageNames";
import { buildTooltipHandler } from "./tooltip";
import { isStageFinish, pointCount, stageEndTick, stageStartTick } from "./points";
import { AXIS_FONT_SIZE, chartTheme } from "./theme";

const HOVER_DIST_PX  = 40;
// + строка счётчиков 💬 над подписями СУ
const BOT_PAD_NORMAL = 46  + COMMENT_ROW_H;
const BOT_PAD_45     = 90  + COMMENT_ROW_H;
const BOT_PAD_90     = 110 + COMMENT_ROW_H;
const NARROW_CHART_PX = 520;
const DIM_ALPHA      = 0.06;
const DIM_ALPHA_SOFT = 0.35;
const BORDER_WIDTH        = 1.8;
const BORDER_WIDTH_PINNED = 2.8;
/** Шаг делений оси в режиме «Позиция» — первый, при котором делений не больше 12. */
const POSITION_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/**
 * Режим оси Y: накопленное время, отставание от лидера, место в общем зачёте на каждом
 * сплите, отставание от первого закреплённого.
 */
export type TYMode = 'abs' | 'leader' | 'position' | 'pinned';

export interface IChartController {
    build(
        data:             IParsedRallyData,
        stages:           IStageInfo[],
        recordMap:        TRecordMap,
        cumPenMap:        Map<string, Map<number, number>>,
        cumSPMap:         Map<string, Map<number, number>>,
        cumSRMap:         Map<string, Map<number, number>>,
        activeDriverKeys: Set<string>,
        activeGroups:     Set<string>,
        activeCars:       Set<string>,
        activeCountries:  Set<string>,
    ): void;
    destroy(): void;
    updateDatasetVisibility(
        data:             IParsedRallyData,
        activeDriverKeys: Set<string>,
        activeGroups:     Set<string>,
        activeCars:       Set<string>,
        activeCountries:  Set<string>,
    ): void;
    /** additive = true — добавить/убрать из сравнения, иначе выделить только этого участника. */
    togglePin(key: string, additive: boolean): void;
    clearPins(): void;
    getPinnedKeys(): string[];
    setYMode(mode: TYMode): void;
    getYMode(): TYMode;
    setHoveredKey(key: string | null): void;
    setOnPinChange(cb: (keys: string[]) => void): void;
    getActiveStages(): IStageInfo[];
    getChart(): any;
    refreshLabels(): void;
    /** Комментарии закреплённых по всем показанным СУ — для ленты под графиком. */
    getPinnedComments(): IChartComment[];
    /** Комментарии на СУ: закреплённых, а если их нет — всех показанных. */
    getStageComments(stageIdx: number): { comments: IChartComment[]; pinnedOnly: boolean };
    /** Комментарий, подсвеченный из ленты (кольцо вокруг точки). */
    setActiveComment(c: IActiveComment | null): void;
    setCommentCallbacks(cb: IChartCommentCallbacks): void;
}

/** Точка экрана, к которой привязывается всплывающий список комментариев СУ. */
export interface IAnchor { x: number; y: number }

export interface IChartCommentCallbacks {
    /** Наведение на ◆ закреплённого (null — ушли). */
    onPointHover:          (c: IActiveComment | null) => void;
    /** Наведение на счётчик 💬 под осью (null — ушли). */
    onStageCommentsHover:  (stageIdx: number | null, anchor: IAnchor | null) => void;
    /** Клик/касание по счётчику 💬. */
    onStageCommentsClick:  (stageIdx: number, anchor: IAnchor) => void;
    /** Клик по графику мимо счётчиков — закрыть открытый список. */
    onOtherClick:          () => void;
}

export function createChartController(): IChartController {
    let chart:              any           = null;
    let canvas:             HTMLCanvasElement | null = null;
    let hoveredDsIdx:       number | null = null;
    let hoveredDsKey:       string | null = null;
    let pinnedKeys:         string[]      = [];
    let pinnedIdxs:         number[]      = [];
    // По умолчанию — отставание от лидера: в накопленном времени борьба за места не видна
    let yMode:              TYMode        = 'leader';
    let hoveredBandIdx:     number | null = null;
    let activeStages:       IStageInfo[]  = [];
    let currentBotPad       = BOT_PAD_NORMAL;
    let hoveredCounterIdx:  number | null = null;
    let activeComment:      IActiveComment | null = null;
    let commentCb:          IChartCommentCallbacks | null = null;

    let clickHandler:       ((e: MouseEvent) => void) | null = null;
    let mousemoveHandler:   ((e: MouseEvent) => void) | null = null;
    let mouseleaveHandler:  (() => void)              | null = null;
    let onPinChange:        ((keys: string[]) => void) | null = null;

    function removeCanvasListeners(): void {
        if (!canvas) return;
        if (clickHandler)     canvas.removeEventListener('click',      clickHandler);
        if (mousemoveHandler) canvas.removeEventListener('mousemove',  mousemoveHandler);
        if (mouseleaveHandler) canvas.removeEventListener('mouseleave', mouseleaveHandler);
        clickHandler = mousemoveHandler = mouseleaveHandler = null;
    }

    /** Закреплённые, которые есть на текущем графике, в порядке закрепления. */
    function syncPinnedIdxs(): void {
        if (!chart) { pinnedIdxs = []; return; }
        const dss = chart.data.datasets;
        pinnedKeys = pinnedKeys.filter(k => dss.some((d: any) => d.driverKey === k));
        pinnedIdxs = pinnedKeys.map(k => dss.findIndex((d: any) => d.driverKey === k));
    }

    function effectiveYMode(): TYMode {
        return yMode === 'pinned' && !pinnedIdxs.length ? 'leader' : yMode;
    }

    /**
     * Насколько приглушать невыделенные линии. В режиме «от выбранного» остальные
     * участники и есть предмет анализа — их лишь слегка приглушаем.
     */
    function dimAlpha(): number {
        return hoveredDsKey === null && effectiveYMode() === 'pinned' ? DIM_ALPHA_SOFT : DIM_ALPHA;
    }

    /** Пересчитывает ds.data из абсолютных значений (ds._abs) и границы оси Y. */
    function applyYMode(): void {
        if (!chart) return;
        const dss  = chart.data.datasets;
        const mode = effectiveYMode();
        const nPts = chart.data.labels.length;

        const title = mode === 'position' ? i18n.t().axisPositionTitle : i18n.t().axisTimeTitle;
        chart.options.scales.y.title.text  = title;
        chart.options.scales.y2.title.text = title;
        if (mode === 'position') { applyPositionMode(nPts); return; }

        let ref: (number | null)[] | null = null;
        if (mode === 'leader') {
            ref = new Array(nPts).fill(null);
            for (const ds of dss) {
                if (ds.hidden) continue;
                (ds._abs as (number | null)[]).forEach((v, i) => {
                    if (v !== null && (ref![i] === null || v < ref![i]!)) ref![i] = v;
                });
            }
        } else if (mode === 'pinned') {
            ref = dss[pinnedIdxs[0]]._abs;
        }

        // В режимах отставания при сравнении (2+ закреплённых) шкала подгоняется под них,
        // иначе их разница в секундах теряется на фоне медленных участников.
        // Один закреплённый — это база отсчёта: шкала по всем видимым.
        const fitToPinned = !!ref && pinnedIdxs.length > 1;
        let min = 0, max = 0;
        dss.forEach((ds: any, di: number) => {
            const abs = ds._abs as (number | null)[];
            ds.data = ref
                ? abs.map((v, i) => v === null || ref![i] === null ? null : v - ref![i]!)
                : abs.slice();
            // Закреплённые — толще и поверх остальных (меньший order рисуется последним)
            ds.borderWidth = pinnedIdxs.includes(di) ? BORDER_WIDTH_PINNED : BORDER_WIDTH;
            ds.order       = pinnedIdxs.includes(di) ? -1 : 0;
            // В абсолютном режиме шкала не зависит от фильтров — как и раньше
            if (ds.hidden && ref) return;
            if (fitToPinned && !pinnedIdxs.includes(di)) return;
            for (const v of ds.data as (number | null)[]) {
                if (v === null) continue;
                if (v < min) min = v;
                if (v > max) max = v;
            }
        });

        const step = computeYAxisStep(Math.max(max - min, 1));
        for (const id of ['y', 'y2']) {
            const s = chart.options.scales[id];
            s.min           = ref ? Math.floor(min / step) * step : 0;
            s.max           = Math.max(Math.ceil(max / step) * step, step);
            s.reverse       = !!ref;
            s.ticks.stepSize = step;
        }
    }

    /**
     * Место по накопленному времени на каждом сплите среди показанных участников
     * (как и «от лидера», учитывает фильтры). Сошедший выпадает, остальные поднимаются.
     */
    function applyPositionMode(nPts: number): void {
        const dss = chart.data.datasets as any[];
        const shown = dss.filter(ds => !ds.hidden);
        const ranks = new Map<any, (number | null)[]>(dss.map(ds => [ds, new Array(nPts).fill(null)]));
        let maxRank = 1;
        for (let i = 1; i < nPts; i++) {
            const at = shown
                .filter(ds => ds._abs[i] !== null)
                .sort((a, b) => a._abs[i] - b._abs[i]);
            // Равное время — равное место (1, 2, 2, 4)
            at.forEach((ds, k) => {
                const prev = at[k - 1];
                const r = prev && prev._abs[i] === ds._abs[i] ? ranks.get(prev)![i]! : k + 1;
                ranks.get(ds)![i] = r;
            });
            maxRank = Math.max(maxRank, at.length);
        }
        dss.forEach((ds, di) => {
            const r = ranks.get(ds)!;
            // На старте у всех ноль — начинаем линию с места на первом сплите, без «веера» из точки 1
            r[0] = r[1];
            ds.data        = r;
            ds.borderWidth = pinnedIdxs.includes(di) ? BORDER_WIDTH_PINNED : BORDER_WIDTH;
            ds.order       = pinnedIdxs.includes(di) ? -1 : 0;
        });

        const step = POSITION_STEPS.find(s => maxRank / s <= 12) ?? POSITION_STEPS[POSITION_STEPS.length - 1];
        for (const id of ['y', 'y2']) {
            const s = chart.options.scales[id];
            s.min            = 1;
            s.max            = Math.max(maxRank, 2);
            s.reverse        = true;
            s.ticks.stepSize = step;
        }
    }

    function notifyPinChange(): void {
        syncPinnedIdxs();
        applyYMode();
        chart?.update('none');
        onPinChange?.([...pinnedKeys]);
    }

    function togglePin(key: string, additive: boolean): void {
        const has = pinnedKeys.includes(key);
        if (additive) {
            pinnedKeys = has ? pinnedKeys.filter(k => k !== key) : [...pinnedKeys, key];
        } else {
            pinnedKeys = has && pinnedKeys.length === 1 ? [] : [key];
        }
        hoveredDsIdx = null;
        notifyPinChange();
    }

    return {
        getChart:        () => chart,
        getPinnedKeys:   () => [...pinnedKeys],
        getYMode:        () => yMode,
        getActiveStages: () => activeStages,

        getPinnedComments(): IChartComment[] {
            if (!chart || !pinnedIdxs.length) return [];
            return collectComments(chart, activeStages, pinnedIdxs);
        },

        getStageComments(stageIdx: number) {
            if (!chart) return { comments: [], pinnedOnly: false };
            return {
                comments:   collectComments(chart, activeStages, commentSourceIdxs(chart, pinnedIdxs), stageIdx),
                pinnedOnly: pinnedIdxs.length > 0,
            };
        },

        setActiveComment(c: IActiveComment | null): void {
            if (c?.key === activeComment?.key && c?.ptIdx === activeComment?.ptIdx) return;
            activeComment = c;
            chart?.render();
        },

        setCommentCallbacks(cb: IChartCommentCallbacks): void {
            commentCb = cb;
        },

        refreshLabels(): void {
            if (!chart) return;
            applyYMode();   // заодно переводит заголовок оси
            chart.update('none');
        },

        setHoveredKey(key: string | null): void {
            if (key === hoveredDsKey) return;
            hoveredDsKey = key;
            // Наведение меняет только прозрачность в плагинах — хватает перерисовки,
            // полный update() на сотнях линий в десятки раз дороже
            chart?.render();
        },

        setOnPinChange(cb: (keys: string[]) => void): void {
            onPinChange = cb;
        },

        destroy(): void {
            removeCanvasListeners();
            if (chart) { chart.destroy(); chart = null; }
            hoveredDsIdx   = null;
            pinnedKeys     = [];
            pinnedIdxs     = [];
            hoveredBandIdx = null;
        },

        togglePin,

        clearPins(): void {
            if (!pinnedKeys.length) return;
            pinnedKeys = [];
            notifyPinChange();
        },

        setYMode(mode: TYMode): void {
            yMode = mode;
            applyYMode();
            chart?.update('none');
        },

        updateDatasetVisibility(data, activeDriverKeys, activeGroups, activeCars, activeCountries): void {
            if (!chart || !data) return;
            chart.data.datasets.forEach((ds: any) => {
                const drv   = data.drivers.find(d => d.username === ds.driverKey);
                const attrOk = !drv
                    || passesAttrFilters(data, { activeGroups, activeCars, activeCountries }, drv);
                ds.hidden   = !activeDriverKeys.has(ds.driverKey) || !attrOk;
            });
            applyYMode();
            chart.update('none');
        },

        build(data, stages, recordMap, cumPenMap, cumSPMap, cumSRMap,
              activeDriverKeys, activeGroups, activeCars, activeCountries): void {
            activeStages = stages;
            const useRot45 = stages.length > ROTATE_45_AT && stages.length <= ROTATE_90_AT;
            const useRot90 = stages.length > ROTATE_90_AT;
            currentBotPad  = useRot90 ? BOT_PAD_90 : useRot45 ? BOT_PAD_45 : BOT_PAD_NORMAL;

            const nPts   = pointCount(stages.length);
            const labels = new Array<string>(nPts).fill('');

            const datasets = buildDatasets(
                data, stages, recordMap, cumPenMap, cumSPMap, cumSRMap,
                activeDriverKeys, activeGroups, activeCars, activeCountries,
            );
            datasets.forEach((ds: any) => { ds._abs = ds.data.slice(); });

            // Смена набора СУ: график переиспользуется — создание нового Chart (и первая
            // отрисовка свежего холста) заметно дороже подмены данных.
            // Плагины, подсказка и обработчики читают activeStages/currentBotPad при вызове.
            if (chart) {
                chart.data.labels   = labels;
                chart.data.datasets = datasets;
                chart.options.layout.padding.bottom = currentBotPad;
                chart.setActiveElements([]);
                hoveredDsIdx      = null;
                hoveredBandIdx    = null;
                hoveredCounterIdx = null;
                activeComment     = null;
                document.getElementById('chart-tooltip')!.style.display = 'none';
                syncPinnedIdxs();
                applyYMode();
                chart.update('none');
                return;
            }

            canvas = document.getElementById('race-chart') as HTMLCanvasElement;
            removeCanvasListeners();

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
                    // На узком экране правая ось-дубликат отнимает место у линий
                    onResize: (c: any, size: { width: number }) => {
                        c.options.scales.y2.display = size.width >= NARROW_CHART_PX;
                    },
                    onHover: (event: any, elements: any[]) => {
                        if (pinnedIdxs.length) { hoveredDsIdx = null; return; }
                        let newIdx: number | null = null;
                        if (elements.length && event.native) {
                            const el   = elements[0];
                            const meta = chart.getDatasetMeta(el.datasetIndex);
                            const pt   = meta.data[el.index];
                            if (pt && Math.hypot(pt.x - (event.x ?? 0), pt.y - (event.y ?? 0)) <= HOVER_DIST_PX)
                                newIdx = el.datasetIndex;
                        }
                        if (newIdx !== hoveredDsIdx) { hoveredDsIdx = newIdx; chart.render(); }
                    },
                    plugins: {
                        legend:  { display: false },
                        tooltip: {
                            enabled:  false,
                            external: buildTooltipHandler(
                                () => activeStages,
                                () => chart,
                                () => pinnedIdxs,
                                effectiveYMode,
                            ),
                        },
                    },
                    scales: buildScales(effectiveYMode),
                },
                plugins: [
                    buildPointsPlugin(),
                    buildHoverDimPlugin(
                        () => hoveredDsKey,
                        () => pinnedIdxs,
                        () => hoveredDsIdx,
                        dimAlpha,
                    ),
                    buildStageNamesPlugin(
                        () => activeStages,
                        () => hoveredBandIdx,
                        // ch, а не chart: первая отрисовка идёт ещё внутри конструктора Chart
                        (ch: any) => countCommentsByStage(ch, activeStages.length, commentSourceIdxs(ch, pinnedIdxs)),
                        () => hoveredCounterIdx,
                    ),
                    buildPinnedCommentsPlugin(
                        () => pinnedIdxs,
                        () => activeStages,
                        () => activeComment,
                        c => commentCb?.onPointHover(c),
                    ),
                ],
            });

            // Закреплённые участники переживают перестройку графика (смену фильтра СУ)
            syncPinnedIdxs();
            applyYMode();
            chart.options.scales.y2.display = chart.width >= NARROW_CHART_PX;
            chart.update('none');

            /** Счётчик 💬 под курсором: индекс СУ и точка привязки списка. */
            const counterAt = (e: MouseEvent): { idx: number; anchor: IAnchor } | null => {
                const rect = canvas!.getBoundingClientRect();
                const my   = e.clientY - rect.top;
                const bot  = chart.chartArea.bottom;
                if (my <= bot + 2 || my > bot + 2 + COMMENT_ROW_H) return null;
                const idx = stageIdxAtX(chart, e.clientX - rect.left, activeStages.length);
                if (idx === null) return null;
                const counts = countCommentsByStage(chart, activeStages.length, commentSourceIdxs(chart, pinnedIdxs));
                if (!counts[idx]) return null;
                const xs = chart.scales.x;
                const xMid = (xs.getPixelForTick(stageStartTick(idx)) + xs.getPixelForTick(stageEndTick(idx))) / 2;
                return { idx, anchor: { x: rect.left + xMid, y: rect.top + bot + 2 } };
            };

            clickHandler = (e: MouseEvent) => {
                const counter = counterAt(e);
                if (counter) { commentCb?.onStageCommentsClick(counter.idx, counter.anchor); return; }
                commentCb?.onOtherClick();
                const additive = e.ctrlKey || e.metaKey || e.shiftKey;
                const hit = handleCanvasClick(e, chart, canvas!, activeStages, currentBotPad);
                if (hit === 'ignore') return;
                if (hit === null) {
                    if (!additive && pinnedKeys.length) { pinnedKeys = []; notifyPinChange(); }
                    return;
                }
                const key = chart.data.datasets[hit]?.driverKey;
                if (key) togglePin(key, additive);
            };

            mousemoveHandler = (e: MouseEvent) => {
                const counter = counterAt(e);
                const newCounterIdx = counter?.idx ?? null;
                if (newCounterIdx !== hoveredCounterIdx) {
                    hoveredCounterIdx = newCounterIdx;
                    commentCb?.onStageCommentsHover(newCounterIdx, counter?.anchor ?? null);
                    chart.render();
                }
                // Подписи СУ — ниже строки счётчиков
                const newBandIdx = counter ? null : resolveHoveredBandIdx(e, chart, canvas!, activeStages, currentBotPad);
                canvas!.style.cursor = counter || newBandIdx !== null ? 'pointer' : '';
                if (newBandIdx !== hoveredBandIdx) {
                    hoveredBandIdx = newBandIdx;
                    chart.render();
                }
            };

            mouseleaveHandler = () => {
                document.getElementById('chart-tooltip')!.style.display = 'none';
                if (hoveredDsIdx !== null)  { hoveredDsIdx  = null; chart?.render(); }
                if (hoveredBandIdx !== null) {
                    hoveredBandIdx = null;
                    canvas!.style.cursor = '';
                    chart?.render();
                }
                if (hoveredCounterIdx !== null) {
                    hoveredCounterIdx = null;
                    commentCb?.onStageCommentsHover(null, null);
                    chart?.render();
                }
            };

            canvas.addEventListener('click',      clickHandler);
            canvas.addEventListener('mousemove',  mousemoveHandler);
            canvas.addEventListener('mouseleave', mouseleaveHandler);
        },
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Индекс СУ, в полосу которого попадает координата x на холсте. */
function stageIdxAtX(chart: any, mx: number, nStages: number): number | null {
    const xs = chart.scales.x;
    for (let i = 0; i < nStages; i++) {
        if (mx >= xs.getPixelForTick(stageStartTick(i)) && mx <= xs.getPixelForTick(stageEndTick(i))) return i;
    }
    return null;
}

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
        const xL = xs.getPixelForTick(stageStartTick(i));
        const xR = xs.getPixelForTick(stageEndTick(i));
        if (mx >= xL && mx <= xR) return i;
    }
    return null;
}

function buildScales(getMode: () => TYMode): object {
    const isGapMode = () => getMode() === 'leader' || getMode() === 'pinned';
    const theme     = chartTheme();
    const axisFont  = { size: AXIS_FONT_SIZE, family: theme.font };
    const yTickConfig = {
        color:    theme.axisText,
        font:     axisFont,
        callback: (v: any) => {
            const n = v as number;
            // Деления считаются в дробных числах (100.00000001) — округляем, дробные места не подписываем
            if (getMode() === 'position') return Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : '';
            return (isGapMode() && n > 0 ? '+' : '') + formatYAxisTick(n, i18n.t().axisTimeUnits);
        },
    };

    // Места: деления 1, шаг, 2·шаг… (Chart.js при min=1 и max, не кратном шагу,
    // делит ось на равные дробные части). Последнее место — если не налезает на соседнее
    const positionTicks = (scale: any): void => {
        if (getMode() !== 'position') return;
        const step = scale.options.ticks.stepSize as number;
        const max  = scale.max as number;
        const vals = [1];
        for (let v = step; v <= max; v += step) if (v > 1) vals.push(v);
        if (max - vals[vals.length - 1] >= step / 2) vals.push(max);
        scale.ticks = vals.map(value => ({ value }));
    };

    return {
        x: {
            type: 'category',
            ticks: { display: false },
            grid: {
                drawTicks: false,
                color:     (ctx: any) => isStageFinish(ctx.index) ? theme.gridStage : theme.gridSplit,
                lineWidth: (ctx: any) => isStageFinish(ctx.index) ? 1.5 : 0.5,
            },
            border: { color: theme.axisBorder },
        },
        y: {
            type:     'linear',
            position: 'left',
            ticks:    { ...yTickConfig },
            afterBuildTicks: positionTicks,
            grid:     {
                color:     (ctx: any) => isGapMode() && ctx.tick?.value === 0 ? theme.axisBorder : theme.gridY,
                lineWidth: 1,
            },
            border:   { color: theme.axisBorder },
            title: {
                display: true,
                text:    i18n.t().axisTimeTitle,
                color:   theme.axisText,
                font:    axisFont,
            },
        },
        y2: {
            type:      'linear',
            position:  'right',
            ticks:     { ...yTickConfig },
            afterBuildTicks: positionTicks,
            grid:      { drawOnChartArea: false },
            border:    { color: theme.axisBorder },
            title: {
                display: true,
                text:    i18n.t().axisTimeTitle,
                color:   theme.axisText,
                font:    axisFont,
            },
        },
    };
}

/** Индекс датасета под курсором; 'ignore' — клик вне области линий (в т.ч. по подписи СУ); null — мимо линий. */
function handleCanvasClick(
    e:      MouseEvent,
    chart:  any,
    canvas: HTMLCanvasElement,
    stages: IStageInfo[],
    botPad: number,
): number | 'ignore' | null {
    if (!chart) return null;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const ca   = chart.chartArea;

    if (my > ca.bottom + 1 && my < ca.bottom + 1 + botPad) {
        const xs = chart.scales.x;
        for (let i = 0; i < stages.length; i++) {
            const xL = xs.getPixelForTick(stageStartTick(i));
            const xR = xs.getPixelForTick(stageEndTick(i));
            if (mx >= xL && mx <= xR) {
                (window as any).__onStageBandClick?.(stages[i].num);
                return 'ignore';
            }
        }
        return 'ignore';
    }

    if (my < ca.top || my > ca.bottom) return 'ignore';

    const elems = chart.getElementsAtEventForMode(e, 'nearest', { intersect: false }, false) as any[];
    if (!elems.length) return null;

    const el   = elems[0];
    const meta = chart.getDatasetMeta(el.datasetIndex);
    const pt   = meta.data[el.index];
    if (!pt || Math.hypot(pt.x - mx, pt.y - my) > HOVER_DIST_PX) return null;
    return el.datasetIndex;
}
