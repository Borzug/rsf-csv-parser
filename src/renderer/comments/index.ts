import type { IParsedRallyData, ILapRecord, TRecordMap } from '../../shared/types';
import type { IDriverStats } from '../results/types';
import type { ICommentEntry, IDriverComments } from './types';
import { i18n } from "../../i18n/index";
import {
    formatTime,
    nullableCompare
} from "../utils";
import { prependFlag } from "../flags";
import { hasRealName } from "../../shared/driverName";
import {
    buildChartFilterPanel,
    updateFilterCounters,
    updateToggleButtonStates,
    type IChartFilterCallbacks,
    type IChartFilterState,
} from "../filters/chartFilters";
import { fullFilterState, isDriverShown } from "../filters/filterState";

/** Префикс id панели фильтров комментариев — та же панель, что у графика и результатов. */
const PREFIX = 'cmt-';

/** Итоговые места и время — считаются один раз при загрузке файла (см. initCommentsModule). */
let rankMap    = new Map<string, number | null>();
let totalTimes = new Map<string, number | null>();
let recordMap: TRecordMap = new Map();
let fileData:  IParsedRallyData | null = null;
/** Все комментарии файла по участникам — фильтры только отбирают из них. */
let allComments: IDriverComments[] = [];

/** Фильтры вкладки — независимы от графика и результатов. */
let filterState: IChartFilterState = fullFilterState(null);
/** Сообщает о смене фильтров (их пишет в ссылку index.ts). */
let onFiltersChanged: () => void = () => {};
let renderQueued = false;

/** Вид устарел (смена языка или фильтров) и будет перестроен при открытии вкладки. */
let dirty = true;
/** Данные, для которых построен текущий вид: прокрутку сбрасываем только для другого файла. */
let lastData: IParsedRallyData | null = null;

/** Места и итоговое время берём из общих расчётов, а не считаем заново. */
export function initCommentsModule(
    data:     IParsedRallyData,
    records:  TRecordMap,
    ranks:    Map<string, number | null>,
    allStats: IDriverStats[],
): void {
    fileData    = data;
    recordMap   = records;
    rankMap     = ranks;
    totalTimes  = new Map(allStats.map(s => [s.username, s.totalTime]));
    allComments = buildCommentsData(data);
    filterState = fullFilterState(data);
    dirty       = true;
}

/** Фильтры комментариев — общий объект: index.ts восстанавливает их из ссылки до построения панели. */
export function getCommentsFilterState(): IChartFilterState {
    return filterState;
}

export function setOnCommentsFiltersChanged(cb: () => void): void {
    onFiltersChanged = cb;
}

/** Панель фильтров вкладки; rankMap — итоговые места для порядка списка участников. */
export function buildCommentsFilters(ranks: Map<string, number | null>): void {
    if (!fileData) return;
    const callbacks: IChartFilterCallbacks = {
        onStagesChanged:  afterFilterChange,
        onDriversChanged: afterFilterChange,
        onDriverHover:    () => {},
    };
    buildChartFilterPanel(fileData, filterState, callbacks, ranks, recordMap, PREFIX);
    updateFilterControls();
}

/** Перестраивает вид, только если он устарел (другой файл, язык или фильтры). */
export function ensureCommentsRendered(): void {
    if (dirty) renderCommentsView();
}

export function invalidateComments(): void {
    dirty = true;
}

function updateFilterControls(): void {
    if (!fileData) return;
    updateFilterCounters(fileData, filterState, PREFIX);
    updateToggleButtonStates(fileData, filterState, PREFIX);
}

/** Несколько изменений подряд («Все» с пересчётом списка) — одна перестройка вида. */
function afterFilterChange(): void {
    updateFilterControls();
    onFiltersChanged();
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => { renderQueued = false; renderCommentsView(); });
}

/** Участники, прошедшие фильтры, и только их комментарии на выбранных СУ. */
function filteredComments(data: IParsedRallyData): IDriverComments[] {
    const result: IDriverComments[] = [];
    for (const driver of allComments) {
        if (!isDriverShown(data, filterState, recordMap, driver)) continue;
        const entries = driver.entries.filter(e => filterState.activeStageNums.has(e.stageNum));
        if (entries.length) result.push(entries.length === driver.entries.length ? driver : { ...driver, entries });
    }
    return result;
}

function renderCommentsView(): void {
    const data = fileData;
    if (!data) return;
    // Вкладка сохраняет прокрутку между переходами; для другого файла начинаем сверху
    const isNewData = data !== lastData;
    lastData = data;
    dirty    = false;

    const container = document.getElementById('view-comments')!;
    const drivers   = filteredComments(data);

    container.innerHTML = '';
    if (isNewData) container.scrollTop = 0;

    if (drivers.length === 0) {
        const empty = document.createElement('div');
        empty.className   = 'cmt-empty';
        // В файле нет комментариев вовсе — или их отсекли фильтры
        empty.textContent = allComments.length ? i18n.t().resultsEmpty : i18n.t().commentsEmpty;
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

    row.appendChild(buildPositionBlock(driver.position));
    row.appendChild(buildDriverCol(driver));
    row.appendChild(buildCardsCol(driver.entries));

    return row;
}

/** Место, как в таблице результатов: у сошедших — DNF. */
function buildPositionBlock(position: number | null): HTMLElement {
    const el = document.createElement('div');
    el.className   = position === null ? 'cmt-pos pos-dnf' : resolvePositionClass(position);
    el.textContent = position === null ? i18n.t().dnf : String(position);
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
        sr.textContent = i18n.t().tooltipSuperRally;
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
