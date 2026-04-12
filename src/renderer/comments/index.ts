import type { IParsedRallyData, ILapRecord } from '../../shared/types';
import type { ICommentEntry, IDriverComments } from './types';
import { i18n } from "../../i18n/index";

const STYLES_ID    = 'comments-module-styles';
const CARD_WIDTH   = 220;
const DRIVER_COL_W = 190;

export function renderCommentsView(data: IParsedRallyData): void {
    injectStyles();
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
    const totalTimes  = buildTotalTimes(data.records);
    const result: IDriverComments[] = [];

    for (const driver of data.drivers) {
        const entries: ICommentEntry[] = data.records
            .filter(r => r.username === driver.username && r.comment.trim())
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
                car:       driver.car,
                group:     driver.group,
                totalTime: totalTimes.get(driver.username) ?? Infinity,
                entries,
            });
        }
    }

    result.sort((a, b) => a.totalTime - b.totalTime);
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

function buildTotalTimes(records: ILapRecord[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const r of records) {
        if (r.time3 === null) continue;
        map.set(r.username, (map.get(r.username) ?? 0) + r.time3 + r.penalty + r.servicePenalty);
    }
    return map;
}

// ── DOM builders ──────────────────────────────────────────────────────────────

function buildDriverRow(driver: IDriverComments): HTMLElement {
    const row = document.createElement('div');
    row.className           = 'cmt-row';
    row.dataset['username'] = driver.username;
    row.dataset['realname'] = driver.realName ?? '';

    row.appendChild(buildDriverCol(driver));
    row.appendChild(buildCardsCol(driver.entries));

    return row;
}

function buildDriverCol(driver: IDriverComments): HTMLElement {
    const col = document.createElement('div');
    col.className = 'cmt-driver';

    const username = document.createElement('div');
    username.className   = 'cmt-drv-username';
    username.textContent = driver.username;
    col.appendChild(username);

    if (driver.realName && driver.realName !== driver.username) {
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

function formatTime(seconds: number): string {
    const abs = Math.abs(seconds);
    const h   = Math.floor(abs / 3600);
    const m   = Math.floor((abs % 3600) / 60);
    const s   = abs % 60;
    const dec = Math.round((s % 1) * 10);
    const ss  = Math.floor(s).toString().padStart(2, '0');
    const sign = seconds < 0 ? '-' : '';
    if (h > 0) return `${sign}${h}:${m.toString().padStart(2, '0')}:${ss}.${dec}`;
    return `${sign}${m}:${ss}.${dec}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles(): void {
    if (document.getElementById(STYLES_ID)) return;
    const style = document.createElement('style');
    style.id = STYLES_ID;
    style.textContent = `
        #view-comments {
            flex: 1;
            overflow-y: auto;
            padding: 12px 20px 24px;
        }
        .cmt-empty {
            color: var(--color-text-tertiary);
            text-align: center;
            margin-top: 80px;
            font-family: var(--font-mono);
            font-size: 13px;
        }
        .cmt-list { display: flex; flex-direction: column; }
        .cmt-row {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            padding: 18px 0;
            border-bottom: 1px solid rgba(255,255,255,0.12);
            transition: background 0.15s;
        }
        .cmt-row:last-child { border-bottom: none; }
        .cmt-row--highlighted { background: rgba(204,34,34,0.06); border-radius: 6px; }
        .cmt-driver {
            width: ${DRIVER_COL_W}px;
            min-width: ${DRIVER_COL_W}px;
            padding-top: 2px;
        }
        .cmt-drv-username {
            font-family: var(--font-mono);
            font-size: 14px;
            font-weight: 500;
            color: var(--color-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmt-drv-realname {
            font-size: 11px;
            color: var(--color-text-tertiary);
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmt-drv-car {
            font-size: 11px;
            color: var(--color-text-secondary);
            margin-top: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmt-drv-count {
            display: inline-block;
            margin-top: 8px;
            font-family: var(--font-mono);
            font-size: 10px;
            color: #888;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--color-border-tertiary);
            border-radius: 4px;
            padding: 1px 6px;
        }
        .cmt-cards { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; }
        .cmt-card {
            width: ${CARD_WIDTH}px;
            min-width: ${CARD_WIDTH}px;
            background: var(--color-background-secondary);
            border: 1px solid var(--color-border-tertiary);
            border-radius: 8px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: border-color 0.15s;
        }
        .cmt-card:hover { border-color: var(--color-border-secondary); }
        .cmt-card-header { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .cmt-badge {
            background: #cc2222;
            color: #fff;
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
            flex-shrink: 0;
        }
        .cmt-stage-name {
            font-size: 11px;
            color: var(--color-text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmt-card-meta { display: flex; flex-direction: column; gap: 3px; }
        .cmt-time {
            font-family: var(--font-mono);
            font-size: 14px;
            font-weight: 500;
            color: var(--color-text-primary);
        }
        .cmt-gap {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--color-text-tertiary);
        }
        .cmt-gap--leader { color: #44aa66; font-size: 10px; font-weight: 500; }
        .cmt-card-badges { display: flex; flex-wrap: wrap; gap: 4px; }
        .cmt-badge-sr {
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 700;
            color: #cc2222;
            background: rgba(204,34,34,0.12);
            border: 1px solid rgba(204,34,34,0.25);
            padding: 1px 6px;
            border-radius: 3px;
        }
        .cmt-badge-penalty {
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 700;
            color: #cc2222;
            background: rgba(204,34,34,0.07);
            border: 1px solid rgba(204,34,34,0.18);
            padding: 1px 6px;
            border-radius: 3px;
        }
        .cmt-card-text {
            font-size: 13px;
            line-height: 1.55;
            color: var(--color-text-primary);
            word-break: break-word;
            border-top: 1px solid var(--color-border-tertiary);
            padding-top: 6px;
            margin-top: 2px;
        }
        .cmt-search-wrap {
            padding: 8px 0 12px;
            border-bottom: 1px solid var(--color-border-tertiary);
            margin-bottom: 4px;
        }
        .cmt-search-input {
            width: 100%;
            margin-top: 6px;
            padding: 5px 8px;
            font-family: var(--font-mono);
            font-size: 12px;
            background: var(--color-background-secondary);
            border: 1px solid var(--color-border-secondary);
            border-radius: 4px;
            color: var(--color-text-primary);
            box-sizing: border-box;
            outline: none;
        }
        .cmt-search-input:focus { border-color: #cc2222; }
    `;
    document.head.appendChild(style);
}
