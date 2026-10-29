import type { IParsedRallyData, TRecordMap } from '../../shared/types';
import type { IDriverResult, IDriverStats } from './types';
import { i18n } from "../../i18n/index.js";
import {
    computeDriverResults,
    recalculateStatsForStages
} from "./compute";
import {
    buildChartFilterPanel,
    updateDriverItemsByStageAndFilter,
    updateFilterCounters,
    updateToggleButtonStates,
    type IChartFilterCallbacks,
    type IChartFilterState,
} from "../filters/chartFilters";
import { passesAttrFilters } from "../filters/filterState";
import { qsa } from "../dom";
import { debounce, SEARCH_DEBOUNCE_MS } from "../utils";
import {
    buildResultsTableHeader,
    renderResultsRows
} from "./tableRenderer";
import { stageLengthKm } from "../data/stageLengths";

export { computeAllDriverStats } from './compute';

let _data:       IParsedRallyData | null = null;
let _recordMap:  TRecordMap = new Map();
let _allStats:   IDriverStats[] = [];
let _selectedRows = new Set<string>();
let _searchActive = false;
/** Таблица не соответствует данным/языку и будет перестроена при открытии вкладки. */
let _dirty = true;
/** Новый файл: прокрутку прошлой таблицы (вкладка теперь её сохраняет) сбрасываем. */
let _resetScroll = true;

/** Префикс id панели фильтров результатов — она строится теми же функциями, что и у графика. */
const PREFIX = 'res-';

/** Фильтры результатов устроены так же, как у графика, но независимы от них. */
let _filterState: IChartFilterState = fullFilterState(null);

function fullFilterState(data: IParsedRallyData | null): IChartFilterState {
    const drivers = data?.drivers ?? [];
    return {
        activeStageNums:   new Set(data?.stages.map(s => s.num) ?? []),
        activeDriverKeys:  new Set(drivers.map(d => d.username)),
        activeGroups:      new Set(data?.groups ?? []),
        activeCars:        new Set(drivers.map(d => d.car).filter(Boolean)),
        activeCountries:   new Set(data?.countries ?? []),
        visibleDriverKeys: new Set(drivers.map(d => d.username)),
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initResultsModule(
    data:      IParsedRallyData,
    recordMap: TRecordMap,
    allStats:  IDriverStats[],
): void {
    _data       = data;
    _recordMap  = recordMap;
    _allStats   = allStats;
    _selectedRows = new Set();
    _dirty        = true;
    _resetScroll  = true;
    _filterState  = fullFilterState(data);
    updateApplyBar();
}

/** rankMap — итоговые места: по ним упорядочен список участников, как на графике. */
export function buildResultsFilters(rankMap: Map<string, number | null>): void {
    if (!_data) return;
    const callbacks: IChartFilterCallbacks = {
        onStagesChanged: () => {
            updateDriverItemsByStageAndFilter(_data!, _filterState, _recordMap, PREFIX);
            afterFilterChange();
        },
        onDriversChanged:   afterFilterChange,
        onGroupsChanged:    afterFilterChange,
        onCarsChanged:      afterFilterChange,
        onCountriesChanged: afterFilterChange,
        onDriverHover:      () => {},
    };
    buildChartFilterPanel(_data, _filterState, callbacks, rankMap, PREFIX);
    updateDriverItemsByStageAndFilter(_data, _filterState, _recordMap, PREFIX);
    updateFilterControls();
    wireApplyButton();
}

/** Перестраивает таблицу, только если она устарела (смена файла или языка). */
export function ensureResultsRendered(): void {
    if (_dirty) renderResultsTable();
}

export function invalidateResults(): void {
    _dirty = true;
}

export function renderResultsTable(): void {
    if (!_data) return;
    _dirty = false;
    const stats   = getFilteredStats();
    const stages  = _data.stages
        .filter(s => _filterState.activeStageNums.has(s.num))
        .sort((a, b) => a.num - b.num);
    // Темп на км — только если известны длины всех выбранных СУ, иначе смесь бессмысленна
    const lengths = stages.map(s => stageLengthKm(s.name));
    const stageKm = lengths.every((l): l is number => l !== null) ? lengths : null;
    const results = computeDriverResults(stats, stageKm);

    const thead = document.getElementById('results-thead')!;
    buildResultsTableHeader(thead, stages, lengths, stageKm !== null, activateParticipantSearch);

    const tbody = document.getElementById('results-tbody')!;
    renderResultsRows(tbody, results, computeStageRanks(results, stages.length), stageKm !== null,
        _selectedRows, toggleRowSelection);

    if (_resetScroll) {
        _resetScroll = false;
        document.querySelector('.results-wrap')?.scrollTo(0, 0);
    }
}

// ── Private ───────────────────────────────────────────────────────────────────

/** Место на каждом СУ среди участников, попавших в таблицу (с учётом фильтра класса). */
function computeStageRanks(results: IDriverResult[], nStages: number): Map<string, (number | null)[]> {
    const ranks = new Map<string, (number | null)[]>();
    results.forEach(r => ranks.set(r.stats.username, new Array(nStages).fill(null)));
    for (let s = 0; s < nStages; s++) {
        results
            .filter(r => r.stats.snaps[s]?.time3 != null)
            .sort((a, b) => a.stats.snaps[s].time3! - b.stats.snaps[s].time3!)
            .forEach((r, i) => { ranks.get(r.stats.username)![s] = i + 1; });
    }
    return ranks;
}

function getFilteredStats(): IDriverStats[] {
    if (!_data) return [];
    const data = _data;
    const allStageNums = data.stages.map(s => s.num);
    return _allStats
        .filter(s => _filterState.activeDriverKeys.has(s.username) && passesAttrFilters(data, _filterState, s))
        .map(s => recalculateStatsForStages(s, _filterState.activeStageNums, allStageNums, _recordMap));
}

function afterFilterChange(): void {
    renderResultsTable();
    updateFilterControls();
}

function updateFilterControls(): void {
    if (!_data) return;
    updateFilterCounters(_data, _filterState, PREFIX);
    updateToggleButtonStates(_data, _filterState, PREFIX);
}

/** «Применить фильтр по участникам»: отмеченные в таблице строки становятся выбором в фильтре. */
function wireApplyButton(): void {
    const btn = document.getElementById('btn-apply-filter');
    if (!btn) return;
    const fresh = btn.cloneNode(true) as HTMLElement;
    btn.replaceWith(fresh);
    fresh.addEventListener('click', () => applyRowSelectionAsFilter(new Set(_selectedRows)));
}

function toggleRowSelection(username: string, row: HTMLElement): void {
    if (_selectedRows.has(username)) {
        _selectedRows.delete(username);
        row.classList.remove('row-selected');
    } else {
        _selectedRows.add(username);
        row.classList.add('row-selected');
    }
    row.setAttribute('aria-selected', String(_selectedRows.has(username)));
    updateApplyBar();
}

function updateApplyBar(): void {
    const bar      = document.getElementById('apply-filter-bar');
    const countEl  = document.getElementById('apply-filter-count');
    if (!bar) return;
    if (_selectedRows.size > 0) {
        bar.classList.add('visible');
        if (countEl) countEl.textContent = i18n.t().selectedCount(_selectedRows.size);
    } else {
        bar.classList.remove('visible');
    }
}

function applyRowSelectionAsFilter(selected: Set<string>): void {
    if (!_data) return;
    _filterState.activeDriverKeys = selected.size > 0
        ? new Set(selected)
        : new Set(_data.drivers.map(d => d.username));
    _selectedRows = new Set();
    updateApplyBar();
    qsa<HTMLElement>(`#${PREFIX}filter-drivers-wrap .filter-item[data-driver-key]`).forEach(item => {
        const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (cb) cb.checked = _filterState.activeDriverKeys.has(item.dataset['driverKey']!);
    });
    afterFilterChange();
}

function activateParticipantSearch(th: HTMLElement): void {
    if (_searchActive) return;
    _searchActive = true;
    const origLabel = th.textContent || i18n.t().colParticipant;
    th.textContent = '';

    const inp         = document.createElement('input');
    inp.className     = 'th-search-input';
    inp.placeholder   = i18n.t().commentsSearchPlaceholder;
    inp.type          = 'text';
    th.appendChild(inp);
    inp.focus();

    const search = debounce(scrollToMatchingParticipant, SEARCH_DEBOUNCE_MS);
    inp.addEventListener('input', () => search(inp.value));
    inp.addEventListener('blur', () => {
        _searchActive = false;
        th.textContent = origLabel;
        th.className   = 'th-participant sticky-col sticky-col-2';
        clearParticipantHighlight();
    });
    inp.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') inp.blur();
    });
}

function scrollToMatchingParticipant(query: string): void {
    clearParticipantHighlight();
    if (!query.trim()) return;
    const ql   = query.trim().toLowerCase();
    const rows = document.querySelectorAll<HTMLElement>('#results-tbody tr');
    for (const row of rows) {
        const name = (row.querySelector('.td-name-user')?.textContent ?? '').toLowerCase()
            + (row.querySelector('.td-name-real')?.textContent ?? '').toLowerCase();
        if (name.includes(ql)) {
            row.classList.add('row-search-highlight');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
        }
    }
}

function clearParticipantHighlight(): void {
    document.querySelectorAll('.row-search-highlight')
        .forEach(r => r.classList.remove('row-search-highlight'));
}
