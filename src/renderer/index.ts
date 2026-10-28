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
import {
    focusLegendSearch,
    initLegendSearch,
    refreshLegendSearch
} from "./chart/legendSearch";
import { updatePinnedBar } from "./chart/pinnedBar";
import {
    ensureCommentsRendered,
    invalidateComments
} from "./comments/index";
import { qs } from "./dom";
import {
    fetchRallyName,
    getCachedRallyName
} from "./rallyName";
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
    ensureResultsRendered,
    initResultsModule,
    invalidateResults
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
/** Название ралли с rallysimfans для текущего файла (см. rallyName.ts). */
let rallyName:     string | null = null;
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
            // Скрытые вкладки перестроятся при открытии
            invalidateResults();
            invalidateComments();
            if (currentTab === 'results')  ensureResultsRendered();
            if (currentTab === 'comments') ensureCommentsRendered(data);
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
    initLegendSearch({
        onPreview: key => chartCtrl.setHoveredKey(key),
        onToggle:  key => chartCtrl.togglePin(key, true),
    });

    qs<HTMLButtonElement>('#btn-filters').addEventListener('click', () => setSidebarOpen(true));
    qs<HTMLButtonElement>('#btn-sidebar-close').addEventListener('click', () => setSidebarOpen(false));
    qs<HTMLElement>('#sidebar-backdrop').addEventListener('click', () => setSidebarOpen(false));

    document.addEventListener('keydown', (e: KeyboardEvent) => {
        // «/» — к поиску по легенде, если не набираем текст в другом поле
        if (e.key === '/' && currentTab === 'chart' && data && !isTextInput(e.target)) {
            e.preventDefault();
            focusLegendSearch();
            return;
        }
        if (e.key !== 'Escape') return;
        if (isSidebarOpen()) setSidebarOpen(false);
        else if (chartCtrl.getPinnedKeys().length) chartCtrl.clearPins();
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
        // Цвет линии берётся по индексу участника. Упорядочив участников по итоговому месту,
        // получаем у соседей по таблице (а значит, и по графику) заведомо разные цвета палитры
        const order = (k: string) => rankMap.get(k) ?? Number.MAX_SAFE_INTEGER;
        data.drivers.sort((a, b) => order(a.username) - order(b.username));

        eventName        = qs<HTMLInputElement>('#inp-event-name').value.trim();
        info.textContent = i18n.t().fileLoaded(data.stages.length, data.drivers.length);
        info.className   = 'file-info ok';
        const rallyId    = currentRallyId();
        rallyName        = rallyId ? getCachedRallyName(rallyId) : null;
        showChart();
        if (rallyId) void refreshRallyName(rallyId);
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

/** Подтягивает название в фоне; ответ для уже сменённого файла игнорируется. */
async function refreshRallyName(rallyId: string): Promise<void> {
    const name = await fetchRallyName(rallyId);
    if (!name || currentRallyId() !== rallyId || name === rallyName) return;
    rallyName = name;
    updateHeaderTitle();
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
    document.getElementById('app')!.classList.remove('sidebar-open');
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

    const urlState = readUrlState();
    restoringUrlState = true;
    if (urlState) applyUrlFilters(urlState);

    document.getElementById('screen-welcome')!.style.display  = 'none';
    document.getElementById('screen-chart')!.style.display    = 'flex';
    updateHeaderTitle();

    applyDomTranslations();
    buildChartFilterPanel(data, chartState, makeFilterCallbacks(), rankMap);
    updateDriverItemsByStageAndFilter(data, chartState, lookups.recordMap);
    buildResultsFilters(() => {});
    switchTab('chart');
    if (urlState) applyUrlView(urlState);
    // Режим оси переживает смену файла, но «от выбранного» без закреплённых теряет смысл
    if (chartCtrl.getYMode() === 'pinned' && !chartCtrl.getPinnedKeys().length) chartCtrl.setYMode('leader');
    syncYModeSwitch();
    refreshLegend();
    updateHeaderStats();
    restoringUrlState = false;
    writeUrlState();
}

// ── View state in URL (#r=…&tab=…&y=…&ss=…&cls=…&pin=…) ───────────────────────
//
// Сами данные в ссылку не попадают — это локальный файл. Ссылка восстанавливает вид
// после загрузки того же CSV (номер ралли сверяется, чтобы не применить чужие настройки).

interface IUrlState {
    tab:    TTab | null;
    yMode:  TYMode | null;
    stages: number[] | null;
    groups: string[] | null;
    pins:   string[];
}

const LIST_SEP = '|';
let restoringUrlState = false;

function currentRallyId(): string | null {
    return data ? fileName.match(/(\d{4,})_table/)?.[1] ?? null : null;
}

function readUrlState(): IUrlState | null {
    const p = new URLSearchParams(location.hash.slice(1));
    if (![...p.keys()].length) return null;
    const rally = p.get('r');
    if (rally && rally !== currentRallyId()) return null;

    const list = (key: string) => p.get(key)?.split(LIST_SEP).filter(Boolean) ?? null;
    const tab  = p.get('tab');
    const y    = p.get('y');
    return {
        tab:    tab === 'chart' || tab === 'results' || tab === 'comments' ? tab : null,
        yMode:  y === 'abs' || y === 'leader' || y === 'position' || y === 'pinned' ? y : null,
        stages: list('ss')?.map(Number).filter(n => !isNaN(n)) ?? null,
        groups: list('cls'),
        pins:   list('pin') ?? [],
    };
}

/** Фильтры применяются до построения панели и графика — чекбоксы строятся из состояния. */
function applyUrlFilters(s: IUrlState): void {
    if (!data) return;
    const stages = s.stages?.filter(n => data!.stages.some(st => st.num === n));
    if (stages?.length) chartState.activeStageNums = new Set(stages);
    const groups = s.groups?.filter(g => data!.groups.includes(g));
    if (groups?.length) chartState.activeGroups = new Set(groups);
}

/** Режим, закреплённые и вкладка — когда график уже построен. */
function applyUrlView(s: IUrlState): void {
    if (!data) return;
    syncDatasetVisibility();
    for (const key of s.pins)
        if (data.drivers.some(d => d.username === key)) chartCtrl.togglePin(key, true);
    if (s.yMode && (s.yMode !== 'pinned' || chartCtrl.getPinnedKeys().length)) {
        chartCtrl.setYMode(s.yMode);
        syncYModeSwitch();
        refreshLegend();
    }
    if (s.tab && s.tab !== 'chart') switchTab(s.tab);
}

/** replaceState — чтобы каждое переключение фильтра не засоряло историю «Назад». */
function writeUrlState(): void {
    if (!data || restoringUrlState) return;
    const p = new URLSearchParams();
    const rallyId = currentRallyId();
    if (rallyId) p.set('r', rallyId);
    if (currentTab !== 'chart') p.set('tab', currentTab);
    const yMode = chartCtrl.getYMode();
    if (yMode !== 'leader') p.set('y', yMode);   // режим по умолчанию в ссылку не пишем
    if (chartState.activeStageNums.size !== data.stages.length)
        p.set('ss', [...chartState.activeStageNums].sort((a, b) => a - b).join(LIST_SEP));
    if (data.groups.length && chartState.activeGroups.size !== data.groups.length)
        p.set('cls', [...chartState.activeGroups].join(LIST_SEP));
    const pins = chartCtrl.getPinnedKeys();
    if (pins.length) p.set('pin', pins.join(LIST_SEP));

    const hash = p.toString();
    history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
}

/**
 * Название в заголовке: введённое вручную → с rallysimfans (если удалось загрузить)
 * → номер ралли из имени файла (NNNNNN_table.csv) → название по умолчанию.
 */
function updateHeaderTitle(): void {
    const rallyId = currentRallyId();
    const title   = eventName
        || rallyName
        || (rallyId ? i18n.t().rallyTitle(rallyId) : i18n.t().defaultTitle);
    const h1 = document.getElementById('header-event-name')!;
    h1.textContent = title;
    h1.title       = rallyId && title !== i18n.t().rallyTitle(rallyId) ? i18n.t().rallyTitle(rallyId) : '';

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

// ── Sidebar drawer (narrow screens) ───────────────────────────────────────────

function isSidebarOpen(): boolean {
    return document.getElementById('app')!.classList.contains('sidebar-open');
}

function setSidebarOpen(open: boolean): void {
    document.getElementById('app')!.classList.toggle('sidebar-open', open);
    const btn = qs<HTMLButtonElement>('#btn-filters');
    btn.setAttribute('aria-expanded', String(open));
    if (open) qs<HTMLButtonElement>('#btn-sidebar-close').focus();
    else btn.focus({ preventScroll: true });
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(tab: TTab): void {
    currentTab = tab;
    for (const t of ['chart', 'results', 'comments'] as TTab[]) {
        const btn = qs<HTMLButtonElement>(`#tab-${t}`);
        btn.classList.toggle('active', tab === t);
        btn.setAttribute('aria-pressed', String(tab === t));
    }

    document.getElementById('view-chart')!.style.display    = tab === 'chart'    ? 'flex' : 'none';
    setHeavyViewShown('view-results',  tab === 'results');
    setHeavyViewShown('view-comments', tab === 'comments');
    document.getElementById('chart-toolbar')!.style.display = tab === 'chart'    ? ''     : 'none';

    document.getElementById('sidebar-chart-filters')!.style.display    = tab === 'chart'    ? '' : 'none';
    document.getElementById('sidebar-results-filters')!.style.display  = tab === 'results'  ? '' : 'none';
    document.getElementById('sidebar-comments-filters')!.style.display = tab === 'comments' ? '' : 'none';

    document.getElementById('legend-panel')!.style.display = tab === 'chart' ? '' : 'none';

    if (tab === 'chart' && !chartCtrl.getChart()) rebuildChart();
    if (tab === 'chart' && chartCtrl.getChart())  refreshLegend();
    if (tab === 'results')  ensureResultsRendered();
    if (tab === 'comments') ensureCommentsRendered(data!);
    writeUrlState();
}

/**
 * Таблица результатов и комментарии на больших ралли — десятки тысяч элементов.
 * display:none сбрасывает их раскладку, и каждое возвращение на вкладку стоило бы
 * сотни миллисекунд. Поэтому однажды показанная вкладка дальше прячется классом
 * .view-parked (content-visibility: hidden) — браузер сохраняет её раскладку.
 */
function setHeavyViewShown(id: string, shown: boolean): void {
    const el = document.getElementById(id)!;
    if (!shown && el.style.display === 'none') return;   // ещё ни разу не показывалась
    el.style.display = 'flex';
    el.classList.toggle('view-parked', !shown);
}

// ── Filter callbacks ──────────────────────────────────────────────────────────

function makeFilterCallbacks(): IChartFilterCallbacks {
    return {
        onStagesChanged: () => {
            updateDriverItemsByStageAndFilter(data!, chartState, lookups.recordMap);
            rebuildChart();   // вызывает afterFilterChange
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
    writeUrlState();
}

// ── Y mode & pinned drivers ───────────────────────────────────────────────────

function setYMode(mode: TYMode): void {
    if (mode === 'pinned' && !chartCtrl.getPinnedKeys().length) return;
    chartCtrl.setYMode(mode);
    syncYModeSwitch();
    refreshLegend();
    const pinned = chartCtrl.getPinnedKeys();
    scrollLegendTo(pinned[pinned.length - 1] ?? null);
    writeUrlState();
}

function syncYModeSwitch(): void {
    const mode      = chartCtrl.getYMode();
    const hasPinned = chartCtrl.getPinnedKeys().length > 0;
    document.querySelectorAll<HTMLButtonElement>('#ymode-switch .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset['ymode'] === mode);
        btn.setAttribute('aria-pressed', String(btn.dataset['ymode'] === mode));
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
    writeUrlState();
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
    rebuildChart();   // вызывает afterFilterChange
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
    refreshLegendSearch();
}

function scrollLegendTo(driverKey: string | null): void {
    const inner = document.getElementById('legend-inner');
    if (!inner || !driverKey) return;
    // Идёт поиск по легенде — она уже стоит на найденном, не уводим её к другому закреплённому
    if (document.activeElement?.id === 'legend-search') return;

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

function isTextInput(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
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
