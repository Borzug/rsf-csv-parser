import type { IStageInfo } from '../../shared/types.js';
import type { IDriverResult, IDriverStageSnap } from './types.js';
import { i18n } from "../../i18n/index.js";
import {
    createElement,
    createTd
} from "../dom.js";
import {
    formatTime,
    formatTimeSigned
} from "../utils.js";
import { prependFlag } from "../flags";

/** km — темп считается на километр (известны длины всех выбранных СУ). */
interface IColumnDef {
    key:      string;
    label:    (km: boolean) => string;
    title:    (km: boolean) => string;
    special?: string;
}

const COLUMNS: IColumnDef[] = [
    { key: 'pos',          label: () => i18n.t().colPosition,       title: () => '' },
    { key: 'name',         label: () => i18n.t().colParticipant,    title: () => '', special: 'search' },
    { key: 'group',        label: () => i18n.t().colClass,          title: () => '' },
    { key: 'car',          label: () => i18n.t().colCar,            title: () => '' },
    { key: 'totalTime',    label: () => i18n.t().colTotalTime,      title: () => '' },
    { key: 'totalPenalty', label: () => i18n.t().colPenalties,      title: () => '' },
    { key: 'avgGapLeader', label: km => paceText(km).colAvgGapLeader,   title: km => paceText(km).colAvgGapLeaderTitle },
    { key: 'avgGapPrev',   label: km => paceText(km).colAvgGapPrev,     title: km => paceText(km).colAvgGapPrevTitle },
    { key: 'cleanLeader',  label: km => paceText(km).colCleanGapLeader, title: km => paceText(km).colCleanGapLeaderTitle },
    { key: 'cleanPrev',    label: km => paceText(km).colCleanGapPrev,   title: km => paceText(km).colCleanGapPrevTitle },
    { key: 'totalGap',     label: () => i18n.t().colTotalGap,       title: () => '' },
    { key: 'sr',           label: () => i18n.t().colSuperRally,     title: () => '' },
];

/** Подписи колонок темпа: «за СУ» или «на км». */
function paceText(km: boolean) {
    const t = i18n.t();
    return km ? t.paceKm : t;
}

/** Отставание на км — доли секунды, поэтому с сотыми; за СУ — как время. */
function formatPace(sec: number | null, km: boolean): string {
    if (sec === null || !km || Math.abs(sec) >= 60) return formatTimeSigned(sec);
    return (sec >= 0 ? '+' : '-') + Math.abs(sec).toFixed(2);
}

export function buildResultsTableHeader(
    thead:         HTMLElement,
    stages:        IStageInfo[],
    lengths:       (number | null)[],
    km:            boolean,
    onSearchClick: (th: HTMLElement) => void,
): void {
    thead.innerHTML = '';
    const tr = document.createElement('tr');
    COLUMNS.forEach(col => {
        const th = document.createElement('th');
        const titleText = col.title(km);
        if (titleText) th.title = titleText;
        if (col.key === 'pos') th.className = 'sticky-col sticky-col-1';
        if (col.special === 'search') {
            th.className = 'th-participant sticky-col sticky-col-2';
            th.innerHTML = col.label(km);
            th.addEventListener('click', () => onSearchClick(th));
        } else {
            th.textContent = col.label(km);
        }
        tr.appendChild(th);
    });
    stages.forEach((st, i) => {
        const th  = createElement('th', 'th-stage', `SS${st.num}`);
        const len = lengths[i];
        th.title = len !== null ? `${st.name} · ${len} ${i18n.t().unitKm}` : st.name;
        tr.appendChild(th);
    });
    thead.appendChild(tr);
}

export function renderResultsRows(
    tbody:        HTMLElement,
    results:      IDriverResult[],
    stageRanks:   Map<string, (number | null)[]>,
    km:           boolean,
    selectedRows: Set<string>,
    onRowClick:   (username: string, row: HTMLElement) => void,
): void {
    tbody.innerHTML = '';
    for (const r of results) {
        const row = buildResultRow(r, stageRanks.get(r.stats.username) ?? [], km, selectedRows);
        row.tabIndex = 0;
        row.addEventListener('click', () => onRowClick(r.stats.username, row));
        row.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            onRowClick(r.stats.username, row);
        });
        tbody.appendChild(row);
    }
}

function buildResultRow(
    r:            IDriverResult,
    stageRanks:   (number | null)[],
    km:           boolean,
    selectedRows: Set<string>,
): HTMLTableRowElement {
    const row = document.createElement('tr');
    row.dataset['username'] = r.stats.username;
    if (selectedRows.has(r.stats.username)) row.classList.add('row-selected');
    row.setAttribute('aria-selected', String(selectedRows.has(r.stats.username)));

    const t = paceText(km);
    // Темп сошедших считается по неполному набору СУ и вводит в заблуждение
    const noPace = r.position === 1 || r.stats.totalTime === null;

    row.appendChild(buildPositionCell(r.stats.totalTime !== null ? r.position : null));
    row.appendChild(buildNameCell(r.stats));
    row.appendChild(buildGroupCell(r.stats.group));
    row.appendChild(createTd('td-time', r.stats.car));
    row.appendChild(createTd('td-time',
        r.stats.totalTime !== null ? formatTime(r.stats.totalTime) : 'DNF'));
    row.appendChild(buildPenaltyCell(r.stats.totalPenalty));
    row.appendChild(buildGapWithTooltip(
        noPace ? '—' : formatPace(r.avgGapFromLeader, km),
        t.colAvgGapLeaderTitle,
        noPace ? null : r.avgGapFromLeader,
        'leader',
    ));
    row.appendChild(buildGapWithTooltip(
        noPace ? '—' : formatPace(r.avgGapFromPrev, km),
        t.colAvgGapPrevTitle,
        noPace ? null : r.avgGapFromPrev,
        'prev',
    ));
    row.appendChild(buildCleanGapCell(
        noPace ? null : r.cleanGapFromLeader,
        noPace ? 0 : r.cleanCountLeader,
        r.totalStageCount,
        'leader',
        km,
    ));
    row.appendChild(buildCleanGapCell(
        noPace ? null : r.cleanGapFromPrev,
        noPace ? 0 : r.cleanCountPrev,
        r.totalStageCount,
        'prev',
        km,
    ));
    row.appendChild(createTd('td-total-gap',
        r.position === 1 ? '—' : (r.totalGap !== null ? formatTimeSigned(r.totalGap) : '—')));
    row.appendChild(buildSRCell(r.stats.srCount));
    r.stats.snaps.forEach((snap, s) => row.appendChild(buildStageCell(snap, stageRanks[s] ?? null)));

    return row;
}

/** Время на СУ и место на нём; SR — пометка, что участок пройден по Super Rally. */
function buildStageCell(snap: IDriverStageSnap, rank: number | null): HTMLTableCellElement {
    if (snap.time3 === null) return createTd('td-stage td-gap-zero', '—');
    const td = createTd('td-stage', formatTime(snap.time3));
    const tail = createElement('span', 'td-stage-tail');
    const rk   = createElement('span', 'td-stage-rank', `${rank ?? ''}`);
    if (rank === 1) rk.classList.add('pos-gold');
    tail.appendChild(rk);
    if (snap.hasSR) tail.appendChild(createElement('span', 'td-stage-sr', 'SR'));
    td.appendChild(tail);
    return td;
}

function buildPositionCell(pos: number | null): HTMLTableCellElement {
    const td = createTd('td-pos sticky-col sticky-col-1', pos !== null ? String(pos) : 'DNF');
    if (pos === null) td.classList.add('pos-dnf');
    if (pos === 1) td.classList.add('pos-gold');
    else if (pos === 2) td.classList.add('pos-silver');
    else if (pos === 3) td.classList.add('pos-bronze');
    return td;
}

function buildNameCell(stats: any): HTMLTableCellElement {
    const td   = createTd('td-name sticky-col sticky-col-2');
    const user = createElement('span', 'td-name-user', stats.username);
    prependFlag(user, stats.country);
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
    vs:   TGapRef,
): HTMLTableCellElement {
    const td    = createTd();
    const inner = createElement('span', 'td-clean', text);
    inner.dataset['tooltip'] = tip;
    colorGap(inner, val, vs);
    td.appendChild(inner);
    return td;
}

function buildCleanGapCell(
    val:        number | null,
    cleanCount: number,
    totalCount: number,
    vs:         TGapRef,
    km:         boolean,
): HTMLTableCellElement {
    const td = createTd();
    if (val === null && cleanCount === 0) {
        td.textContent = '—';
        return td;
    }
    const inner = createElement('span', 'td-clean',
        val !== null ? formatPace(val, km) : '—');
    inner.dataset['tooltip'] = i18n.t().cleanGapCellTooltip(cleanCount, totalCount);
    colorGap(inner, val, vs);
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

/** С кем сравнивается отставание: с лидером или с предыдущим местом. */
type TGapRef = 'leader' | 'prev';

/**
 * Отставание от лидера есть почти у всех, и красным оно лишь «шумит» — оставляем нейтральным.
 * Красный/зелёный — только для сравнения с соседом, где знак действительно разный.
 */
function colorGap(el: HTMLElement, val: number | null, vs: TGapRef): void {
    if (val === null) return;
    if (vs === 'leader') el.classList.add('td-gap-leader');
    else el.style.color = gapColor(val);
}

function gapColor(val: number): string {
    if (val > 0) return 'var(--red-text)';
    if (val < 0) return 'var(--green)';
    return '#888';
}
