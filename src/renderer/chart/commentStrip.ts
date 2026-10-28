import { i18n } from "../../i18n/index";
import { createElement } from "../dom";
import type { IChartComment } from "./chartComments";
import type { IActiveComment } from "./pluginPinnedComments";

/**
 * Лента комментариев закреплённых под графиком. Наведение на запись обводит точку на
 * графике и наоборот; клик оставляет на графике только этот СУ (повторный — возвращает).
 */
export interface ICommentStripCallbacks {
    onEntryHover: (c: IActiveComment | null) => void;
    onEntryClick: (stageNum: number) => void;
}

const COLLAPSED_KEY = 'rsf-comment-strip-collapsed';

let callbacks: ICommentStripCallbacks | null = null;
let collapsed = readCollapsed();

const stripEl = (): HTMLElement => document.getElementById('comment-strip')!;
const listEl  = (): HTMLElement => document.getElementById('comment-strip-list')!;

export function initCommentStrip(cb: ICommentStripCallbacks): void {
    callbacks = cb;
    const toggle = document.getElementById('comment-strip-toggle')!;
    toggle.addEventListener('click', () => {
        collapsed = !collapsed;
        try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : ''); } catch { /* приватный режим */ }
        applyCollapsed();
    });

    const list   = listEl();
    const entryOf = (e: Event): HTMLElement | null =>
        (e.target as HTMLElement | null)?.closest<HTMLElement>('.cs-entry') ?? null;
    const commentOf = (el: HTMLElement): IActiveComment =>
        ({ key: el.dataset['key']!, ptIdx: Number(el.dataset['pt']) });

    list.addEventListener('mouseover', (e: MouseEvent) => {
        const el = entryOf(e);
        if (el && !el.contains(e.relatedTarget as Node | null)) callbacks?.onEntryHover(commentOf(el));
    });
    list.addEventListener('mouseout', (e: MouseEvent) => {
        const el = entryOf(e);
        if (el && !el.contains(e.relatedTarget as Node | null)) callbacks?.onEntryHover(null);
    });
    list.addEventListener('focusin',  (e: FocusEvent) => {
        const el = entryOf(e);
        if (el) callbacks?.onEntryHover(commentOf(el));
    });
    list.addEventListener('focusout', () => callbacks?.onEntryHover(null));
    list.addEventListener('click', (e: MouseEvent) => {
        const el = entryOf(e);
        if (el) callbacks?.onEntryClick(Number(el.dataset['stage']));
    });
}

/** Перестраивает ленту; без комментариев у закреплённых она скрыта. */
export function renderCommentStrip(comments: IChartComment[], pinnedCount: number): void {
    const strip = stripEl();
    const list  = listEl();
    list.innerHTML = '';
    strip.hidden = comments.length === 0;
    if (!comments.length) return;

    const t = i18n.t();
    document.getElementById('comment-strip-title')!.textContent = t.cmtStripTitle(comments.length);
    const sorted = [...comments].sort((a, b) => a.stageIdx - b.stageIdx || a.ptIdx - b.ptIdx);

    for (const c of sorted) {
        const li  = createElement('li');
        const btn = createElement('button', 'cs-entry');
        btn.type = 'button';
        btn.title = t.cmtStripEntryTitle;
        btn.dataset['key']   = c.key;
        btn.dataset['pt']    = String(c.ptIdx);
        btn.dataset['stage'] = String(c.stageNum);

        const dot = createElement('span', 'cs-dot');
        dot.style.background = c.color;
        dot.setAttribute('aria-hidden', 'true');
        btn.appendChild(dot);
        btn.appendChild(createElement('span', 'cs-ss', `SS${c.stageNum}`));
        btn.appendChild(createElement('span', 'cs-stage', c.stageName));
        // Имя нужно, только когда сравниваются несколько участников
        if (pinnedCount > 1) btn.appendChild(createElement('span', 'cs-driver', c.name));
        btn.appendChild(createElement('span', 'cs-text', c.text));
        li.appendChild(btn);
        list.appendChild(li);
    }
    applyCollapsed();
}

/** Подсветка записи при наведении на ◆ на графике. */
export function highlightCommentEntry(c: IActiveComment | null): void {
    const list = listEl();
    list.querySelectorAll('.cs-entry.cs-active').forEach(el => el.classList.remove('cs-active'));
    if (!c) return;
    const el = list.querySelector<HTMLElement>(
        `.cs-entry[data-key="${CSS.escape(c.key)}"][data-pt="${c.ptIdx}"]`);
    if (!el) return;
    el.classList.add('cs-active');
    if (collapsed) return;
    // Прокрутка только внутри ленты
    const lr = list.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.top < lr.top || er.bottom > lr.bottom)
        list.scrollBy({ top: er.top - lr.top - lr.height / 2 + er.height / 2, behavior: 'smooth' });
}

function applyCollapsed(): void {
    stripEl().classList.toggle('collapsed', collapsed);
    document.getElementById('comment-strip-toggle')!.setAttribute('aria-expanded', String(!collapsed));
}

function readCollapsed(): boolean {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}
