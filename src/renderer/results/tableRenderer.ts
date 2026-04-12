import type { IDriverResult } from './types.js';
import { i18n } from "../../i18n/index.js";
import {
    createElement,
    createTd
} from "../dom.js";
import {
    formatTime,
    formatTimeSigned
} from "../utils.js";

interface IColumnDef {
    key:      string;
    label:    () => string;
    title:    () => string;
    special?: string;
}

const COLUMNS: IColumnDef[] = [
    { key: 'pos',          label: () => i18n.t().colPosition,       title: () => '' },
    { key: 'name',         label: () => i18n.t().colParticipant,    title: () => '', special: 'search' },
    { key: 'group',        label: () => i18n.t().colClass,          title: () => '' },
    { key: 'car',          label: () => i18n.t().colCar,            title: () => '' },
    { key: 'totalTime',    label: () => i18n.t().colTotalTime,      title: () => '' },
    { key: 'totalPenalty', label: () => i18n.t().colPenalties,      title: () => '' },
    { key: 'avgGapLeader', label: () => i18n.t().colAvgGapLeader,   title: () => i18n.t().colAvgGapLeaderTitle },
    { key: 'avgGapPrev',   label: () => i18n.t().colAvgGapPrev,     title: () => i18n.t().colAvgGapPrevTitle },
    { key: 'cleanLeader',  label: () => i18n.t().colCleanGapLeader, title: () => i18n.t().colCleanGapLeaderTitle },
    { key: 'cleanPrev',    label: () => i18n.t().colCleanGapPrev,   title: () => i18n.t().colCleanGapPrevTitle },
    { key: 'totalGap',     label: () => i18n.t().colTotalGap,       title: () => '' },
    { key: 'sr',           label: () => i18n.t().colSuperRally,     title: () => '' },
];

export function buildResultsTableHeader(
    thead:         HTMLElement,
    onSearchClick: (th: HTMLElement) => void,
): void {
    thead.innerHTML = '';
    const tr = document.createElement('tr');
    COLUMNS.forEach(col => {
        const th = document.createElement('th');
        const titleText = col.title();
        if (titleText) th.title = titleText;
        if (col.special === 'search') {
            th.className = 'th-participant';
            th.innerHTML = col.label();
            th.addEventListener('click', () => onSearchClick(th));
        } else {
            th.textContent = col.label();
        }
        tr.appendChild(th);
    });
    thead.appendChild(tr);
}

export function renderResultsRows(
    tbody:        HTMLElement,
    results:      IDriverResult[],
    selectedRows: Set<string>,
    onRowClick:   (username: string, row: HTMLElement) => void,
): void {
    tbody.innerHTML = '';
    for (const r of results) {
        const row = buildResultRow(r, selectedRows);
        row.addEventListener('click', () => onRowClick(r.stats.username, row));
        tbody.appendChild(row);
    }
}

function buildResultRow(r: IDriverResult, selectedRows: Set<string>): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.dataset['username'] = r.stats.username;
    if (selectedRows.has(r.stats.username)) row.classList.add('row-selected');

    const t = i18n.t();

    row.appendChild(buildPositionCell(r.position));
    row.appendChild(buildNameCell(r.stats));
    row.appendChild(buildGroupCell(r.stats.group));
    row.appendChild(createTd('td-time', r.stats.car));
    row.appendChild(createTd('td-time',
        r.stats.totalTime !== null ? formatTime(r.stats.totalTime) : 'DNF'));
    row.appendChild(buildPenaltyCell(r.stats.totalPenalty));
    row.appendChild(buildGapWithTooltip(
        r.position === 1 ? '—' : formatTimeSigned(r.avgGapFromLeader),
        t.colAvgGapLeaderTitle,
        r.avgGapFromLeader,
    ));
    row.appendChild(buildGapWithTooltip(
        r.position === 1 ? '—' : formatTimeSigned(r.avgGapFromPrev),
        t.colAvgGapPrevTitle,
        r.avgGapFromPrev,
    ));
    row.appendChild(buildCleanGapCell(
        r.position === 1 ? null : r.cleanGapFromLeader,
        r.cleanCountLeader,
        r.totalStageCount,
    ));
    row.appendChild(buildCleanGapCell(
        r.position === 1 ? null : r.cleanGapFromPrev,
        r.cleanCountPrev,
        r.totalStageCount,
    ));
    row.appendChild(createTd('td-total-gap',
        r.position === 1 ? '—' : (r.totalGap !== null ? formatTimeSigned(r.totalGap) : '—')));
    row.appendChild(buildSRCell(r.stats.srCount));

    return row;
}

function buildPositionCell(pos: number): HTMLTableCellElement {
    const td = createTd('td-pos', String(pos));
    if (pos === 1) td.classList.add('pos-gold');
    else if (pos === 2) td.classList.add('pos-silver');
    else if (pos === 3) td.classList.add('pos-bronze');
    return td;
}

function buildNameCell(stats: any): HTMLTableCellElement {
    const td   = createTd('td-name');
    const user = createElement('span', 'td-name-user', stats.username);
    td.appendChild(user);
    if (stats.realName && stats.realName !== stats.username) {
        const real = createElement('span', 'td-name-real', ` | ${stats.realName}`);
        td.appendChild(real);
    }
    return td;
}

function buildGroupCell(group: string): HTMLTableCellElement {
    const td = createTd();
    if (group) {
        const badge = createElement('span', 'badge-group', group);
        td.appendChild(badge);
    }
    return td;
}

function buildPenaltyCell(penalty: number): HTMLTableCellElement {
    return createTd(
        penalty > 0 ? 'td-gap-pos' : 'td-gap-zero',
        penalty > 0 ? `+${formatTime(penalty)}` : '—',
    );
}

function buildGapWithTooltip(
    text: string,
    tip:  string,
    val:  number | null,
): HTMLTableCellElement {
    const td    = createTd();
    const inner = createElement('span', 'td-clean', text);
    inner.dataset['tooltip'] = tip;
    if (val !== null) inner.style.color = gapColor(val);
    td.appendChild(inner);
    return td;
}

function buildCleanGapCell(
    val:        number | null,
    cleanCount: number,
    totalCount: number,
): HTMLTableCellElement {
    const td = createTd();
    if (val === null && cleanCount === 0) {
        td.textContent = '—';
        return td;
    }
    const inner = createElement('span', 'td-clean',
        val !== null ? formatTimeSigned(val) : '—');
    inner.dataset['tooltip'] = i18n.t().cleanGapCellTooltip(cleanCount, totalCount);
    if (val !== null) inner.style.color = gapColor(val);
    td.appendChild(inner);
    return td;
}

function buildSRCell(srCount: number): HTMLTableCellElement {
    const td = createTd();
    if (srCount > 0) {
        td.textContent = String(srCount);
        td.className   = 'td-sr';
    } else {
        td.textContent = '0';
        td.className   = 'td-gap-zero';
    }
    return td;
}

function gapColor(val: number): string {
    if (val > 0) return 'var(--red-hi)';
    if (val < 0) return 'var(--green)';
    return '#888';
}
