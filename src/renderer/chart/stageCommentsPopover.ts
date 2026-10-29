import { i18n } from "../../i18n/index";
import { createElement } from "../dom";
import type { IChartComment } from "./chartComments";
import type { IAnchor } from "./controller";

/**
 * Список комментариев на СУ по счётчику 💬 под осью: закреплённых участников,
 * а если никто не закреплён — всех показанных, по месту на этом СУ.
 * Наведение открывает список, уход с счётчика и списка — закрывает; клик (касание)
 * закрепляет его открытым до клика мимо или Escape.
 */
const CLOSE_DELAY_MS = 180;
/** Отступ от краёв окна и зазор до строки счётчиков */
const VIEW_MARGIN    = 8;
const ANCHOR_GAP     = 6;
/** Высота списка: не меньше и не больше этих значений, но не выше места над счётчиком */
const MIN_HEIGHT     = 160;
const MAX_HEIGHT     = 380;
const TOP_RESERVE    = 70;

type TGetComments = (stageIdx: number) => { comments: IChartComment[]; pinnedOnly: boolean };

let getComments: TGetComments | null = null;
let openIdx:     number | null = null;
let sticky       = false;
let closeTimer:  number | undefined;

const popEl = (): HTMLElement => document.getElementById('stage-comments')!;

export function initStageCommentsPopover(get: TGetComments): void {
    getComments = get;
    const pop = popEl();
    pop.addEventListener('mouseenter', cancelClose);
    pop.addEventListener('mouseleave', () => { if (!sticky) scheduleClose(); });

    // Клики по самому графику разбирает контроллер (счётчик или мимо — onOtherClick)
    document.addEventListener('mousedown', (e: MouseEvent) => {
        if (openIdx !== null && !pop.contains(e.target as Node)
            && (e.target as HTMLElement).id !== 'race-chart') closeStageComments();
    });
    // Захват: Escape закрывает список раньше общего обработчика, снимающего закрепления
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' && openIdx !== null) {
            e.stopImmediatePropagation();
            closeStageComments();
        }
    }, true);
}

/** Наведение на счётчик (null — курсор ушёл с него). */
export function hoverStageComments(stageIdx: number | null, anchor: IAnchor | null): void {
    if (stageIdx === null || !anchor) { if (!sticky) scheduleClose(); return; }
    if (sticky && openIdx !== stageIdx) return;   // закреплённый список не перебиваем наведением
    open(stageIdx, anchor);
}

/** Клик по счётчику: открыть и закрепить, повторный клик — закрыть. */
export function toggleStageComments(stageIdx: number, anchor: IAnchor): void {
    if (sticky && openIdx === stageIdx) { closeStageComments(); return; }
    open(stageIdx, anchor);
    sticky = true;
}

export function closeStageComments(): void {
    cancelClose();
    openIdx = null;
    sticky  = false;
    popEl().hidden = true;
}

function open(stageIdx: number, anchor: IAnchor): void {
    cancelClose();
    if (openIdx === stageIdx && !popEl().hidden) return;
    const data = getComments?.(stageIdx);
    if (!data || !data.comments.length) { closeStageComments(); return; }
    openIdx = stageIdx;
    sticky  = false;
    render(data.comments, data.pinnedOnly);
    position(anchor);
}

function render(comments: IChartComment[], pinnedOnly: boolean): void {
    const t   = i18n.t();
    const pop = popEl();
    pop.innerHTML = '';
    const first = comments[0];

    const head = createElement('div', 'scp-head');
    head.appendChild(createElement('span', 'scp-ss', `SS${first.stageNum}`));
    head.appendChild(createElement('span', 'scp-stage', first.stageName));
    head.appendChild(createElement('span', 'scp-scope',
        `${pinnedOnly ? t.stageCmtScopePinned : t.stageCmtScopeAll} · ${comments.length}`));
    pop.appendChild(head);

    // По месту на СУ: у кого меньше накопленное время в точке комментария — выше
    const sorted = [...comments].sort((a, b) =>
        (a.abs ?? Number.MAX_VALUE) - (b.abs ?? Number.MAX_VALUE));
    const list = createElement('ul', 'scp-list');
    for (const c of sorted) {
        const li  = createElement('li', 'scp-item');
        const who = createElement('div', 'scp-who');
        const dot = createElement('span', 'scp-dot');
        dot.style.background = c.color;
        dot.setAttribute('aria-hidden', 'true');
        who.appendChild(dot);
        who.appendChild(createElement('span', 'scp-name', c.name));
        li.appendChild(who);
        li.appendChild(createElement('div', 'scp-text', c.text));
        list.appendChild(li);
    }
    pop.appendChild(list);
    pop.hidden = false;
    list.scrollTop = 0;
}

/** Над строкой счётчиков, по центру СУ, в пределах окна. */
function position(anchor: IAnchor): void {
    const pop = popEl();
    pop.style.maxHeight = `${Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, anchor.y - TOP_RESERVE))}px`;
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = Math.min(Math.max(anchor.x - w / 2, VIEW_MARGIN), window.innerWidth - w - VIEW_MARGIN);
    const top  = Math.max(anchor.y - h - ANCHOR_GAP, VIEW_MARGIN);
    pop.style.left = `${left}px`;
    pop.style.top  = `${top}px`;
}

function scheduleClose(): void {
    cancelClose();
    closeTimer = window.setTimeout(closeStageComments, CLOSE_DELAY_MS);
}

function cancelClose(): void {
    window.clearTimeout(closeTimer);
    closeTimer = undefined;
}
