import type { IParsedRallyData, ILapRecord } from '../../shared/types';
import type { IDriverStats } from '../results/types';
import type { ICommentEntry, IDriverComments } from './types';
import { i18n } from "../../i18n/index";
import {
    formatTime,
    nullableCompare
} from "../utils";
import { prependFlag } from "../flags";
import { hasRealName } from "../../shared/driverName";

/** Итоговые места и время — считаются один раз при загрузке файла (см. initCommentsModule). */
let rankMap    = new Map<string, number | null>();
let totalTimes = new Map<string, number | null>();

/** Данные, для которых построен текущий вид; null — вид устарел (смена языка). */
let renderedFor: IParsedRallyData | null = null;
let lastData:    IParsedRallyData | null = null;

/** Места и итоговое время берём из общих расчётов, а не считаем заново. */
export function initCommentsModule(ranks: Map<string, number | null>, allStats: IDriverStats[]): void {
    rankMap    = ranks;
    totalTimes = new Map(allStats.map(s => [s.username, s.totalTime]));
}

/** Перестраивает вид, только если он устарел (другой файл или смена языка). */
export function ensureCommentsRendered(data: IParsedRallyData): void {
    if (renderedFor !== data) renderCommentsView(data);
}

export function invalidateComments(): void {
    renderedFor = null;
}

export function renderCommentsView(data: IParsedRallyData): void {
    // Вкладка сохраняет прокрутку между переходами; для другого файла начинаем сверху
    const isNewData = data !== lastData;
    renderedFor = lastData = data;
    renderSidebarSearch();

    const container = document.getElementById('view-comments')!;
    const drivers   = buildCommentsData(data);

    container.innerHTML = '';

    if (drivers.length === 0) {
        const empty = document.createElement('div');
        empty.className   = 'cmt-empty';
        empty.textContent = i18n.t().commentsEmpty;
        container.appendChild(empty);
        return;
    }

    const list = document.createElement('div');
    list.className = 'cmt-list';
    list.id        = 'cmt-list';

    for (const driver of drivers) {
        list.appendChild(buildDriverRow(driver));
    }

    container.appendChild(list);
    if (isNewData) container.scrollTop = 0;
}

// ── Sidebar search ────────────────────────────────────────────────────────────

function renderSidebarSearch(): void {
    const target = document.getElementById('filter-comments-search');
    if (!target) return;

    const existing = document.getElementById('cmt-search-wrap');
    if (existing) {
        updateSidebarSearchLabels(existing);
        return;
    }

    const wrap = document.createElement('div');
    wrap.id        = 'cmt-search-wrap';
    wrap.className = 'cmt-search-wrap';

    const label = document.createElement('div');
    label.id          = 'cmt-search-label';
    label.className   = 'filter-group-title';
    label.textContent = i18n.t().commentsSearchLabel;

    const input = document.createElement('input');
    input.id          = 'cmt-search-input';
    input.type        = 'text';
    input.className   = 'cmt-search-input';
    input.placeholder = i18n.t().commentsSearchPlaceholder;

    input.addEventListener('input', () => scrollToDriverMatch(input.value.trim()));

    wrap.appendChild(label);
    wrap.appendChild(input);
    target.appendChild(wrap);
}

function updateSidebarSearchLabels(wrap: HTMLElement): void {
    const label = wrap.querySelector<HTMLElement>('#cmt-search-label');
    const input = wrap.querySelector<HTMLInputElement>('#cmt-search-input');
    if (label) label.textContent = i18n.t().commentsSearchLabel;
    if (input) input.placeholder = i18n.t().commentsSearchPlaceholder;
}

function scrollToDriverMatch(query: string): void {
    const list      = document.getElementById('cmt-list');
    const container = document.getElementById('view-comments');
    if (!list || !container) return;

    const rows = list.querySelectorAll<HTMLElement>('.cmt-row');
    rows.forEach(r => r.classList.remove('cmt-row--highlighted'));

    if (!query) return;

    const q = query.toLowerCase();
    for (const row of rows) {
        const username = row.dataset['username'] ?? '';
        const realName = row.dataset['realname'] ?? '';
        if (username.toLowerCase().includes(q) || realName.toLowerCase().includes(q)) {
            row.classList.add('cmt-row--highlighted');
            row.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
        }
    }
}

// ── Data building ─────────────────────────────────────────────────────────────

function buildCommentsData(data: IParsedRallyData): IDriverComments[] {
    const leaderTimes = buildLeaderTimes(data.records);
    const result: IDriverComments[] = [];

    // Записи с комментарием по участникам — один проход вместо фильтра всех записей на каждого
    const commented = new Map<string, ILapRecord[]>();
    for (const r of data.records) {
        if (!r.comment.trim()) continue;
        const list = commented.get(r.username);
        if (list) list.push(r); else commented.set(r.username, [r]);
    }

    for (const driver of data.drivers) {
        const entries: ICommentEntry[] = (commented.get(driver.username) ?? [])
            .sort((a, b) => a.stageNum - b.stageNum)
            .map(r => ({
                stageNum:       r.stageNum,
                stageName:      r.stageName,
                time3:          r.time3,
                gapToLeader:    r.time3 !== null && leaderTimes.has(r.stageNum)
                    ? r.time3 - leaderTimes.get(r.stageNum)!
                    : null,
                penalty:        r.penalty,
                servicePenalty: r.servicePenalty,
                superRally:     r.superRally,
                comment:        r.comment.trim(),
            }));

        if (entries.length > 0) {
            result.push({
                username:  driver.username,
                realName:  driver.realName,
                country:   driver.country,
                car:       driver.car,
                group:     driver.group,
                position:  rankMap.get(driver.username) ?? null,
                totalTime: totalTimes.get(driver.username) ?? null,
                entries,
            });
        }
    }

    result.sort((a, b) => nullableCompare(a.totalTime, b.totalTime));
    return result;
}

function buildLeaderTimes(records: ILapRecord[]): Map<number, number> {
    const map = new Map<number, number>();
    for (const r of records) {
        if (r.time3 === null) continue;
        const cur = map.get(r.stageNum);
        if (cur === undefined || r.time3 < cur) map.set(r.stageNum, r.time3);
    }
    return map;
}

// ── DOM builders ──────────────────────────────────────────────────────────────

function buildDriverRow(driver: IDriverComments): HTMLElement {
    const row = document.createElement('div');
    row.className           = 'cmt-row';
    row.dataset['username'] = driver.username;
    row.dataset['realname'] = driver.realName ?? '';

    row.appendChild(buildPositionBlock(driver.position));
    row.appendChild(buildDriverCol(driver));
    row.appendChild(buildCardsCol(driver.entries));

    return row;
}

/** Место, как в таблице результатов: у сошедших — DNF. */
function buildPositionBlock(position: number | null): HTMLElement {
    const el = document.createElement('div');
    el.className   = position === null ? 'cmt-pos pos-dnf' : resolvePositionClass(position);
    el.textContent = position === null ? 'DNF' : String(position);
    return el;
}

function resolvePositionClass(position: number): string {
    if (position === 1) return 'cmt-pos cmt-pos--gold';
    if (position === 2) return 'cmt-pos cmt-pos--silver';
    if (position === 3) return 'cmt-pos cmt-pos--bronze';
    return 'cmt-pos';
}

function buildDriverCol(driver: IDriverComments): HTMLElement {
    const col = document.createElement('div');
    col.className = 'cmt-driver';

    const username = document.createElement('div');
    username.className   = 'cmt-drv-username';
    username.textContent = driver.username;
    prependFlag(username, driver.country);
    col.appendChild(username);

    if (hasRealName(driver)) {
        const realName = document.createElement('div');
        realName.className   = 'cmt-drv-realname';
        realName.textContent = driver.realName;
        col.appendChild(realName);
    }

    if (driver.car) {
        const car = document.createElement('div');
        car.className   = 'cmt-drv-car';
        car.textContent = driver.car;
        col.appendChild(car);
    }

    const count = document.createElement('div');
    count.className   = 'cmt-drv-count';
    count.textContent = i18n.t().commentsCount(driver.entries.length);
    col.appendChild(count);

    return col;
}

function buildCardsCol(entries: ICommentEntry[]): HTMLElement {
    const col = document.createElement('div');
    col.className = 'cmt-cards';

    for (const entry of entries) {
        col.appendChild(buildCommentCard(entry));
    }

    return col;
}

function buildCommentCard(entry: ICommentEntry): HTMLElement {
    const card = document.createElement('div');
    card.className = 'cmt-card';

    card.appendChild(buildCardHeader(entry));
    card.appendChild(buildCardMeta(entry));

    if (entry.superRally || entry.penalty > 0 || entry.servicePenalty > 0) {
        card.appendChild(buildCardBadges(entry));
    }

    const text = document.createElement('div');
    text.className   = 'cmt-card-text';
    text.textContent = entry.comment;
    card.appendChild(text);

    return card;
}

function buildCardHeader(entry: ICommentEntry): HTMLElement {
    const header = document.createElement('div');
    header.className = 'cmt-card-header';

    const badge = document.createElement('span');
    badge.className   = 'cmt-badge';
    badge.textContent = `SS${entry.stageNum}`;

    const stageName = document.createElement('span');
    stageName.className   = 'cmt-stage-name';
    stageName.textContent = entry.stageName;
    stageName.title       = entry.stageName;

    header.appendChild(badge);
    header.appendChild(stageName);
    return header;
}

function buildCardMeta(entry: ICommentEntry): HTMLElement {
    const meta = document.createElement('div');
    meta.className = 'cmt-card-meta';

    if (entry.time3 !== null) {
        const time = document.createElement('span');
        time.className   = 'cmt-time';
        time.textContent = formatTime(entry.time3);
        meta.appendChild(time);
    }

    if (entry.gapToLeader === 0) {
        const gap = document.createElement('span');
        gap.className   = 'cmt-gap cmt-gap--leader';
        gap.textContent = i18n.t().commentsLeader;
        meta.appendChild(gap);
    } else if (entry.gapToLeader !== null && entry.gapToLeader > 0) {
        const gap = document.createElement('span');
        gap.className   = 'cmt-gap';
        gap.textContent = i18n.t().commentsGap(formatTime(entry.gapToLeader));
        meta.appendChild(gap);
    }

    return meta;
}

function buildCardBadges(entry: ICommentEntry): HTMLElement {
    const badges = document.createElement('div');
    badges.className = 'cmt-card-badges';

    if (entry.superRally) {
        const sr = document.createElement('span');
        sr.className   = 'cmt-badge-sr';
        sr.textContent = 'Super Rally';
        badges.appendChild(sr);
    }

    if (entry.penalty > 0) {
        const pen = document.createElement('span');
        pen.className   = 'cmt-badge-penalty';
        pen.textContent = i18n.t().commentsPenalty(formatTime(entry.penalty));
        badges.appendChild(pen);
    }

    if (entry.servicePenalty > 0) {
        const sp = document.createElement('span');
        sp.className   = 'cmt-badge-penalty';
        sp.textContent = i18n.t().commentsServicePenalty(formatTime(entry.servicePenalty));
        badges.appendChild(sp);
    }

    return badges;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
