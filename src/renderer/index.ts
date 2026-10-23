import type { IParsedRallyData } from '../shared/types';
import { parseCsvText } from "../csvParser";
import { i18n } from "../i18n/index";
import { initLangSwitcher } from "../lang-switcher";
import {
    createChartController,
    TYMode
} from "./chart/controller";
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
import { applyDomTranslations } from "./i18n-dom";
import {
    buildResultsFilters,
    computeAllDriverStats,
    initResultsModule,
    renderResultsTable
} from "./results/index";
import { nullableCompare } from "./utils";

declare const window: Window & {
    __onStageBandClick?: (stageNum: number) => void;
};

type TTab = 'chart' | 'results' | 'comments';

const RSF_RALLY_URL = 'https://www.rallysimfans.hu/rbr/rally_online.php?centerbox=rally_list_details.php&rally_id=';

// ── App state ─────────────────────────────────────────────────────────────────

let data:          IParsedRallyData | null = null;
let eventName      = '';
let fileName       = '';
let currentTab:    TTab = 'chart';
let legendExpanded = false;
let prevStageFilter: Set<number> | null = null;
/** Итоговое место участника по всем СУ; null — сошёл. */
let rankMap        = new Map<string, number | null>();

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
    applyDomTranslations();

    initLangSwitcher(() => {
        applyDomTranslations();
        updateHeaderTitle();
        updateResumeButton();
        if (data) {
            buildChartFilterPanel(data, chartState, makeFilterCallbacks(), rankMap);
            updateDriverItemsByStageAndFilter(data, chartState, lookups.recordMap);
            afterFilterChange();
            buildResultsFilters(() => {});
            updateHeaderStats();
            renderResultsTable();
            renderCommentsView(data);
            chartCtrl.refreshLabels();
            onPinsChanged(chartCtrl.getPinnedKeys());
        }
    });

    qs<HTMLButtonElement>('#btn-choose-file').addEventListener('click', () => {
        qs<HTMLInputElement>('#file-input').click();
    });
    qs<HTMLInputElement>('#file-input').addEventListener('change', onFileInputChange);
    initFileDrop();

    qs<HTMLInputElement>('#inp-event-name').addEventListener('input', e => {
        eventName = (e.target as HTMLInputElement).value.trim();
        updateHeaderTitle();
    });
    qs<HTMLButtonElement>('#btn-back').addEventListener('click', showWelcome);
    qs<HTMLButtonElement>('#btn-resume').addEventListener('click', resumeChart);
    qs<HTMLButtonElement>('#pinned-close').addEventListener('click', () => chartCtrl.clearPins());
    qs<HTMLButtonElement>('#tab-chart').addEventListener('click', () => switchTab('chart'));
    qs<HTMLButtonElement>('#tab-results').addEventListener('click', () => switchTab('results'));
    qs<HTMLButtonElement>('#tab-comments').addEventListener('click', () => switchTab('comments'));
    qs<HTMLButtonElement>('#legend-expand-btn').addEventListener('click', toggleLegendExpand);

    document.querySelectorAll<HTMLButtonElement>('#ymode-switch .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => setYMode(btn.dataset['ymode'] as TYMode));
    });

    chartCtrl.setOnPinChange(onPinsChanged);

    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' && chartCtrl.getPinnedKeys().length) chartCtrl.clearPins();
    });
    document.addEventListener('mousemove', onCellTooltipMove);

    (window as any).__onStageBandClick = handleStageBandClick;
});

// ── File loading ──────────────────────────────────────────────────────────────

async function onFileInputChange(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (file) await loadFile(file);
}

function initFileDrop(): void {
    const overlay  = document.getElementById('drop-overlay')!;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
    let depth = 0;

    document.addEventListener('dragenter', e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth++;
        overlay.classList.add('visible');
    });
    document.addEventListener('dragover', e => {
        if (hasFiles(e)) e.preventDefault();
    });
    document.addEventListener('dragleave', e => {
        if (!hasFiles(e)) return;
        if (--depth <= 0) { depth = 0; overlay.classList.remove('visible'); }
    });
    document.addEventListener('drop', e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth = 0;
        overlay.classList.remove('visible');
        const file = e.dataTransfer?.files?.[0];
        if (file) void loadFile(file);
    });
}

async function loadFile(file: File): Promise<void> {
    const btn  = qs<HTMLButtonElement>('#btn-choose-file');
    const info = qs<HTMLElement>('#file-info');
    btn.disabled     = true;
    info.textContent = i18n.t().fileReading;
    info.className   = 'file-info loading';

    try {
        const text   = await readFileAsText(file);
        const parsed = parseCsvText(text);

        chartCtrl.destroy();
        data     = parsed;
        fileName = file.name;
        lookups  = buildRallyLookups(data);

        const allStats = computeAllDriverStats(data, lookups.recordMap);
        initResultsModule(data, lookups.recordMap, allStats);
        rankMap = new Map();
        [...allStats]
            .sort((a, b) => nullableCompare(a.totalTime, b.totalTime))
            .forEach((s, i) => rankMap.set(s.username, s.totalTime !== null ? i + 1 : null));

        eventName        = qs<HTMLInputElement>('#inp-event-name').value.trim();
        info.textContent = i18n.t().fileLoaded(data.stages.length, data.drivers.length);
        info.className   = 'file-info ok';
        showChart();
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        info.textContent = `${i18n.t().fileError}: ${msg}`;
        info.className   = 'file-info error';
        // Ошибку видно только на стартовом экране — переходим туда, если файл бросили на график
        showWelcome();
    } finally {
        btn.disabled = false;
    }
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(i18n.t().fileReadError));
        reader.readAsText(file, 'utf-8');
    });
}

// ── Screens ───────────────────────────────────────────────────────────────────

/** Стартовый экран. Загруженные данные сохраняются — к ним можно вернуться. */
function showWelcome(): void {
    document.getElementById('screen-welcome')!.style.display = 'flex';
    document.getElementById('screen-chart')!.style.display   = 'none';
    document.getElementById('chart-tooltip')!.style.display  = 'none';
    document.getElementById('header-stats')!.textContent     = '';
    updateResumeButton();
}

function resumeChart(): void {
    if (!data) return;
    document.getElementById('screen-welcome')!.style.display = 'none';
    document.getElementById('screen-chart')!.style.display   = 'flex';
    updateHeaderTitle();
    updateHeaderStats();
    switchTab(currentTab);
}

function updateResumeButton(): void {
    const btn = qs<HTMLButtonElement>('#btn-resume');
    btn.style.display = data ? '' : 'none';
    if (data) btn.textContent = i18n.t().resumeButton(fileName);
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
    updateHeaderTitle();

    applyDomTranslations();
    buildChartFilterPanel(data, chartState, makeFilterCallbacks(), rankMap);
    buildResultsFilters(() => {});
    switchTab('chart');
    updateHeaderStats();
}

/** Ручное название → номер ралли из имени файла (NNNNNN_table.csv) → название по умолчанию. */
function updateHeaderTitle(): void {
    const rallyId = data ? fileName.match(/(\d{4,})_table/)?.[1] ?? null : null;
    const title   = eventName || (rallyId ? i18n.t().rallyTitle(rallyId) : i18n.t().defaultTitle);
    document.getElementById('header-event-name')!.textContent = title;

    const link = document.getElementById('header-rally-link') as HTMLAnchorElement;
    link.style.display = rallyId ? '' : 'none';
    if (rallyId) {
        link.href  = RSF_RALLY_URL + rallyId;
        link.title = i18n.t().rallyLinkTitle;
    }
}

function updateHeaderStats(): void {
    if (!data) return;
    const lastStage = data.stages.reduce((m, s) => s.num > m ? s.num : m, 0);
    const finished  = data.drivers.filter(
        d => lookups.recordMap.get(d.username)?.get(lastStage)?.time3 != null,
    ).length;
    document.getElementById('header-stats')!.textContent =
        i18n.t().headerStats(finished, data.drivers.length, data.stages.length);
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(tab: TTab): void {
    currentTab = tab;
    qs<HTMLButtonElement>('#tab-chart').classList.toggle('active',    tab === 'chart');
    qs<HTMLButtonElement>('#tab-results').classList.toggle('active',  tab === 'results');
    qs<HTMLButtonElement>('#tab-comments').classList.toggle('active', tab === 'comments');

    document.getElementById('view-chart')!.style.display    = tab === 'chart'    ? 'flex' : 'none';
    document.getElementById('view-results')!.style.display  = tab === 'results'  ? 'flex' : 'none';
    document.getElementById('view-comments')!.style.display = tab === 'comments' ? 'flex' : 'none';
    document.getElementById('chart-toolbar')!.style.display = tab === 'chart'    ? ''     : 'none';

    document.getElementById('sidebar-chart-filters')!.style.display    = tab === 'chart'    ? '' : 'none';
    document.getElementById('sidebar-results-filters')!.style.display  = tab === 'results'  ? '' : 'none';
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

// ── Y mode & pinned drivers ───────────────────────────────────────────────────

function setYMode(mode: TYMode): void {
    if (mode === 'pinned' && !chartCtrl.getPinnedKeys().length) return;
    chartCtrl.setYMode(mode);
    syncYModeSwitch();
    refreshLegend();
    const pinned = chartCtrl.getPinnedKeys();
    scrollLegendTo(pinned[pinned.length - 1] ?? null);
}

function syncYModeSwitch(): void {
    const mode      = chartCtrl.getYMode();
    const hasPinned = chartCtrl.getPinnedKeys().length > 0;
    document.querySelectorAll<HTMLButtonElement>('#ymode-switch .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset['ymode'] === mode);
    });
    const pinnedBtn = qs<HTMLButtonElement>('#ymode-pinned');
    pinnedBtn.disabled = !hasPinned;
    pinnedBtn.title    = hasPinned ? '' : i18n.t().yModePinnedDisabled;
}

function onPinsChanged(keys: string[]): void {
    // «От выбранного» без выбранных теряет смысл — переключаемся на отставание от лидера
    if (!keys.length && chartCtrl.getYMode() === 'pinned') chartCtrl.setYMode('leader');
    syncYModeSwitch();
    updatePinnedBar(data, keys, key => chartCtrl.togglePin(key, true));
    refreshLegend();
    scrollLegendTo(keys[keys.length - 1] ?? null);
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

    updatePinnedBar(data, chartCtrl.getPinnedKeys(), key => chartCtrl.togglePin(key, true));
    syncYModeSwitch();
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
        onDriverClick: (key, additive) => chartCtrl.togglePin(key, additive),
    };

    updateLegendPanel(
        data, chartCtrl.getChart(), chartCtrl.getActiveStages(),
        lookups.recordMap,
        legendExpanded,
        chartCtrl.getPinnedKeys(),
        chartCtrl.getYMode() !== 'abs',
        callbacks,
    );
}

function scrollLegendTo(driverKey: string | null): void {
    const inner = document.getElementById('legend-inner');
    if (!inner || !driverKey) return;

    const items = inner.querySelectorAll<HTMLElement>('.legend-item');
    for (const item of items) {
        if (item.dataset['driverKey'] === driverKey) {
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
