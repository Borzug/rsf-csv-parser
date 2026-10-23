import type { IParsedRallyData } from '../../shared/types';
import type { IDriverResult, IDriverStats } from './types';
import { i18n } from "../../i18n/index.js";
import {
    computeDriverResults,
    recalculateStatsForStages
} from "./compute";
import {
    buildResultsFilterPanel,
    IResultsFilterState,
    syncResultsDriverCheckboxes,
    updateResultsFilterCounters
} from "./filterPanel";
import {
    buildResultsTableHeader,
    renderResultsRows
} from "./tableRenderer";

export { computeAllDriverStats } from './compute';

let _data:       IParsedRallyData | null = null;
let _recordMap:  Map<string, Map<number, any>> = new Map();
let _allStats:   IDriverStats[] = [];
let _selectedRows = new Set<string>();
let _searchActive = false;

let _filterState: IResultsFilterState = {
    stageFilter:      new Set(),
    groupFilter:      new Set(),
    driverFilter:     new Set(),
    activeDriverKeys: new Set(),
};

// ── Public API ────────────────────────────────────────────────────────────────

export function initResultsModule(
    data:      IParsedRallyData,
    recordMap: Map<string, Map<number, any>>,
    allStats:  IDriverStats[],
): void {
    _data       = data;
    _recordMap  = recordMap;
    _allStats   = allStats;
    _selectedRows = new Set();
    _filterState = {
        stageFilter:      new Set(data.stages.map(s => s.num)),
        groupFilter:      new Set(data.groups),
        driverFilter:     new Set(),
        activeDriverKeys: new Set(data.drivers.map(d => d.username)),
    };
    updateApplyBar();
}

export function buildResultsFilters(onChange: () => void): void {
    if (!_data) return;
    buildResultsFilterPanel(
        _data,
        _filterState,
        () => { renderResultsTable(); onChange(); },
        (selected) => applyRowSelectionAsFilter(selected),
    );
}

export function renderResultsTable(): void {
    if (!_data) return;
    const stats   = getFilteredStats();
    const results = computeDriverResults(stats);
    const stages  = _data.stages
        .filter(s => _filterState.stageFilter.has(s.num))
        .sort((a, b) => a.num - b.num);

    const thead = document.getElementById('results-thead')!;
    buildResultsTableHeader(thead, stages, activateParticipantSearch);

    const tbody = document.getElementById('results-tbody')!;
    renderResultsRows(tbody, results, computeStageRanks(results, stages.length), _selectedRows, toggleRowSelection);
}

export function setResultsGroupFilter(groups: Set<string>): void {
    _filterState.groupFilter = groups;
}

export function getSelectedRows(): Set<string> {
    return _selectedRows;
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
    const allStageNums = _data.stages.map(s => s.num);
    let stats = _allStats;

    if (_data.groups.length && _filterState.groupFilter.size > 0)
        stats = stats.filter(s => _filterState.groupFilter.has(s.group));

    if (_filterState.driverFilter.size > 0)
        stats = stats.filter(s => _filterState.driverFilter.has(s.username));

    return stats.map(s =>
        recalculateStatsForStages(s, _filterState.stageFilter, allStageNums, _recordMap),
    );
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
    _filterState.driverFilter = selected.size > 0 ? new Set(selected) : new Set();
    _selectedRows = new Set();
    updateApplyBar();
    syncResultsDriverCheckboxes(_data, _filterState);
    updateResultsFilterCounters(_data, _filterState);
    renderResultsTable();
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

    let debounce: number | null = null;
    inp.addEventListener('input', () => {
        if (debounce !== null) clearTimeout(debounce);
        debounce = setTimeout(() => scrollToMatchingParticipant(inp.value), 150) as unknown as number;
    });
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
