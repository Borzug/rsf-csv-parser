import type { IParsedRallyData } from '../shared/types';
import { parseCsvText } from "../csvParser";
import { createChartController } from "./chart/controller";
import {
    ILegendPanelCallbacks,
    updateLegendPanel
} from "./chart/legendPanel";
import { buildRallyLookups } from "./chart/lookups";
import { updatePinnedBar } from "./chart/pinnedBar";
import { renderCommentsView } from "./comments/index";
import { qs } from "./dom";
import {
    buildChartFilterPanel,
    IChartFilterCallbacks,
    IChartFilterState,
    syncStageCheckboxes,
    updateDriverItemsByStageAndFilter,
    updateFilterCounters,
    updateToggleButtonStates
} from "./filters/chartFilters";
import {
    buildResultsFilters,
    computeAllDriverStats,
    initResultsModule,
    renderResultsTable
} from "./results/index";

declare const window: Window & {
    __onStageBandClick?: (stageNum: number) => void;
};

type TTab = 'chart' | 'results' | 'comments';

// ── App state ─────────────────────────────────────────────────────────────────

let data:           IParsedRallyData | null = null;
let eventName       = '';
let legendExpanded  = false;
let prevStageFilter: Set<number> | null = null;

let lookups = buildRallyLookups({ records: [], stages: [], drivers: [], groups: [] });

const chartState: IChartFilterState = {
    activeStageNums:   new Set(),
    activeDriverKeys:  new Set(),
    activeGroups:      new Set(),
    activeCars:        new Set(),
    visibleDriverKeys: new Set(),
};

const chartCtrl = createChartController();

// ── Boot ──────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    qs<HTMLButtonElement>('#btn-choose-file').addEventListener('click', () => {
        qs<HTMLInputElement>('#file-input').click();
    });
    qs<HTMLInputElement>('#file-input').addEventListener('change', onFileInputChange);

    qs<HTMLInputElement>('#inp-event-name').addEventListener('input', e => {
        eventName = (e.target as HTMLInputElement).value.trim();
        const el = document.getElementById('header-event-name');
        if (el) el.textContent = eventName || 'Rally Race Chart';
    });
    qs<HTMLButtonElement>('#btn-back').addEventListener('click', showWelcome);
    qs<HTMLButtonElement>('#pinned-close').addEventListener('click', unpinDriver);
    qs<HTMLButtonElement>('#tab-chart').addEventListener('click', () => switchTab('chart'));
    qs<HTMLButtonElement>('#tab-results').addEventListener('click', () => switchTab('results'));
    qs<HTMLButtonElement>('#tab-comments').addEventListener('click', () => switchTab('comments'));
    qs<HTMLButtonElement>('#legend-expand-btn').addEventListener('click', toggleLegendExpand);

    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' && chartCtrl.getPinnedIndex() !== null) unpinDriver();
    });
    document.addEventListener('mousemove', onCellTooltipMove);

    (window as any).__onStageBandClick = handleStageBandClick;
});

// ── File loading ──────────────────────────────────────────────────────────────

async function onFileInputChange(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const btn  = qs<HTMLButtonElement>('#btn-choose-file');
    const info = qs<HTMLElement>('#file-info');
    btn.disabled     = true;
    info.textContent = 'Чтение файла…';
    info.className   = 'file-info loading';

    chartCtrl.destroy();

    try {
        const text   = await readFileAsText(file);
        data         = parseCsvText(text);
        lookups      = buildRallyLookups(data);

        const allStats = computeAllDriverStats(data, lookups.recordMap);
        initResultsModule(data, lookups.recordMap, allStats);

        eventName        = qs<HTMLInputElement>('#inp-event-name').value.trim();
        info.textContent = `✓ Загружено: ${data.stages.length} участков, ${data.drivers.length} участников`;
        info.className   = 'file-info ok';
        showChart();
    } catch (err: unknown) {
        info.textContent = `✗ Ошибка: ${err instanceof Error ? err.message : String(err)}`;
        info.className   = 'file-info error';
    } finally {
        btn.disabled = false;
        // сброс input чтобы можно было выбрать тот же файл повторно
        (e.target as HTMLInputElement).value = '';
    }
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsText(file, 'utf-8');
    });
}

// ── Screens ───────────────────────────────────────────────────────────────────

function showWelcome(): void {
    document.getElementById('screen-welcome')!.style.display = 'flex';
    document.getElementById('screen-chart')!.style.display   = 'none';
    document.getElementById('chart-tooltip')!.style.display  = 'none';
    chartCtrl.destroy();
    document.getElementById('header-stats')!.textContent  = '';
    document.getElementById('pinned-bar')!.style.display  = 'none';
    const legendItems = document.getElementById('legend-items');
    if (legendItems) legendItems.innerHTML = '';
    document.getElementById('legend-panel')!.style.display = 'none';
    prevStageFilter = null;
}

function showChart(): void {
    if (!data) return;

    chartState.activeStageNums   = new Set(data.stages.map(s => s.num));
    chartState.activeDriverKeys  = new Set(data.drivers.map(d => d.username));
    chartState.activeGroups      = new Set(data.groups);
    chartState.activeCars        = new Set(data.drivers.map(d => d.car).filter(Boolean));
    chartState.visibleDriverKeys = new Set(data.drivers.map(d => d.username));
    prevStageFilter  = null;
    legendExpanded   = false;

    document.getElementById('screen-welcome')!.style.display  = 'none';
    document.getElementById('screen-chart')!.style.display    = 'flex';
    document.getElementById('header-event-name')!.textContent = eventName || 'Rally Race Chart';

    buildChartFilterPanel(data, chartState, makeFilterCallbacks());
    buildResultsFilters(() => {});
    switchTab('chart');
    updateHeaderStats();
}

function updateHeaderStats(): void {
    if (!data) return;
    const lastStage = data.stages.reduce((m, s) => s.num > m ? s.num : m, 0);
    const finished  = data.drivers.filter(
        d => lookups.recordMap.get(d.username)?.get(lastStage)?.time3 != null,
    ).length;
    document.getElementById('header-stats')!.textContent =
        `| 👤 ${finished}/${data.drivers.length}  |  SS ${data.stages.length}`;
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(tab: TTab): void {
    qs<HTMLButtonElement>('#tab-chart').classList.toggle('active',    tab === 'chart');
    qs<HTMLButtonElement>('#tab-results').classList.toggle('active',  tab === 'results');
    qs<HTMLButtonElement>('#tab-comments').classList.toggle('active', tab === 'comments');

    document.getElementById('view-chart')!.style.display    = tab === 'chart'    ? 'flex' : 'none';
    document.getElementById('view-results')!.style.display  = tab === 'results'  ? 'flex' : 'none';
    document.getElementById('view-comments')!.style.display = tab === 'comments' ? 'flex' : 'none';

    document.getElementById('sidebar-chart-filters')!.style.display   = tab === 'chart'   ? '' : 'none';
    document.getElementById('sidebar-results-filters')!.style.display = tab === 'results' ? '' : 'none';
    document.getElementById('sidebar-comments-filters')!.style.display = tab === 'comments' ? '' : 'none';

    document.getElementById('legend-panel')!.style.display = tab === 'chart' ? '' : 'none';

    if (tab === 'chart' && !chartCtrl.getChart()) rebuildChart();
    if (tab === 'chart' && chartCtrl.getChart())  refreshLegend();
    if (tab === 'results')  renderResultsTable();
    if (tab === 'comments') renderCommentsView(data!);
}

// ── Filter callbacks ──────────────────────────────────────────────────────────

function makeFilterCallbacks(): IChartFilterCallbacks {
    return {
        onStagesChanged: () => {
            updateDriverItemsByStageAndFilter(data!, chartState, lookups.recordMap);
            rebuildChart();
            afterFilterChange();
        },
        onDriversChanged: () => {
            syncDatasetVisibility();
            afterFilterChange();
        },
        onGroupsChanged: () => {
            syncDatasetVisibility();
            afterFilterChange();
        },
        onCarsChanged: () => {
            syncDatasetVisibility();
            afterFilterChange();
        },
        onDriverHover: (key: string | null) => {
            chartCtrl.setHoveredKey(key);
        },
    };
}

function syncDatasetVisibility(): void {
    chartCtrl.updateDatasetVisibility(
        data!,
        chartState.activeDriverKeys,
        chartState.activeGroups,
        chartState.activeCars,
    );
}

function afterFilterChange(): void {
    if (!data) return;
    updateFilterCounters(data, chartState);
    updateToggleButtonStates(data, chartState);
    refreshLegend();
}

// ── Pinned driver ─────────────────────────────────────────────────────────────

function unpinDriver(): void {
    chartCtrl.pinDriver(null);
    updatePinnedBar(data, chartCtrl.getChart(), null);
    highlightLegendItem(null);
    refreshLegend();
}

// ── Stage band click ──────────────────────────────────────────────────────────

function handleStageBandClick(stageNum: number): void {
    const isSingleAndSame =
        chartState.activeStageNums.size === 1
        && chartState.activeStageNums.has(stageNum)
        && prevStageFilter !== null;

    if (isSingleAndSame) {
        chartState.activeStageNums = prevStageFilter!;
        prevStageFilter = null;
    } else {
        prevStageFilter = new Set(chartState.activeStageNums);
        chartState.activeStageNums = new Set([stageNum]);
    }

    syncStageCheckboxes(chartState.activeStageNums);
    updateDriverItemsByStageAndFilter(data!, chartState, lookups.recordMap);
    rebuildChart();
    afterFilterChange();
}

// ── Chart rebuild ─────────────────────────────────────────────────────────────

function rebuildChart(): void {
    if (!data) return;
    const stages = data.stages
        .filter(s => chartState.activeStageNums.has(s.num))
        .sort((a, b) => a.num - b.num);

    chartCtrl.build(
        data, stages,
        lookups.recordMap, lookups.cumPenMap, lookups.cumSPMap, lookups.cumSRMap,
        chartState.activeDriverKeys, chartState.activeGroups, chartState.activeCars,
    );

    chartCtrl.setOnPinChange((key) => {
        updatePinnedBar(data, chartCtrl.getChart(), chartCtrl.getPinnedIndex());
        highlightLegendItem(key);
        refreshLegend();
    });

    document.getElementById('pinned-bar')!.style.display = 'none';
    afterFilterChange();
}

// ── Legend ────────────────────────────────────────────────────────────────────

function toggleLegendExpand(): void {
    legendExpanded = !legendExpanded;
    refreshLegend();
}

function refreshLegend(): void {
    if (!data || !chartCtrl.getChart()) return;

    const callbacks: ILegendPanelCallbacks = {
        onDriverHover: (key) => chartCtrl.setHoveredKey(key),
        onDriverClick: (key) => {
            const chart = chartCtrl.getChart();
            if (!chart) return;
            const dsIdx = chart.data.datasets.findIndex((ds: any) => ds.driverKey === key);
            if (dsIdx === -1) return;
            const currentPinned = chartCtrl.getPinnedIndex();
            if (currentPinned === dsIdx) {
                chartCtrl.pinDriver(null);
                updatePinnedBar(data, chart, null);
                highlightLegendItem(null);
                refreshLegend();
            } else {
                chartCtrl.pinDriver(dsIdx);
                updatePinnedBar(data, chart, dsIdx);
                highlightLegendItem(key);
                refreshLegend();
            }
        },
    };

    updateLegendPanel(
        data, chartCtrl.getChart(), chartCtrl.getActiveStages(),
        lookups.recordMap,
        chartState.activeDriverKeys, chartState.activeGroups, chartState.activeCars,
        legendExpanded,
        chartCtrl.getPinnedDriverKey(),
        callbacks,
    );
}

function highlightLegendItem(driverKey: string | null): void {
    const inner = document.getElementById('legend-inner');
    if (!inner) return;

    inner.querySelectorAll('.legend-item.pinned-highlight')
        .forEach(el => el.classList.remove('pinned-highlight'));

    if (!driverKey) return;

    const items = inner.querySelectorAll<HTMLElement>('.legend-item');
    for (const item of items) {
        if (item.dataset['driverKey'] === driverKey) {
            item.classList.add('pinned-highlight');
            const itemRect  = item.getBoundingClientRect();
            const innerRect = inner.getBoundingClientRect();
            const offset    = itemRect.top - innerRect.top - (innerRect.height / 2) + (itemRect.height / 2);
            inner.scrollBy({ top: offset, behavior: 'smooth' });
            break;
        }
    }
}

// ── Cell tooltip ──────────────────────────────────────────────────────────────

function onCellTooltipMove(e: MouseEvent): void {
    const tipEl = document.getElementById('cell-tooltip')!;
    const tip   = (e.target as HTMLElement).dataset['tooltip'];
    if (!tip) { tipEl.style.display = 'none'; return; }

    tipEl.textContent = tip;
    tipEl.style.display = 'block';
    let tx = e.clientX + 12;
    let ty = e.clientY - 30;
    const tr = tipEl.getBoundingClientRect();
    if (tx + tr.width  > window.innerWidth  - 8) tx = e.clientX - tr.width - 12;
    if (ty < 8)                                   ty = e.clientY + 16;
    tipEl.style.left = `${tx}px`;
    tipEl.style.top  = `${ty}px`;
}

export {};
