import { i18n } from "../../i18n/index";

/**
 * Быстрый переход по легенде: список не фильтруется — совпадения подсвечиваются,
 * легенда прокручивается к текущему, его линия выделяется на графике.
 * Enter — добавить в сравнение (или убрать), ↑/↓ — следующее/предыдущее совпадение,
 * Escape — очистить поиск.
 */
export interface ILegendSearchCallbacks {
    /** Показать линию участника на графике (null — снять выделение). */
    onPreview: (key: string | null) => void;
    /** Добавить участника в сравнение или убрать из него. */
    onToggle:  (key: string) => void;
}

let callbacks: ILegendSearchCallbacks | null = null;
let matches:   string[] = [];
let current    = 0;

const inputEl = (): HTMLInputElement => document.getElementById('legend-search') as HTMLInputElement;
const countEl = (): HTMLElement      => document.getElementById('legend-search-count')!;
const items   = (): HTMLElement[]    =>
    Array.from(document.querySelectorAll<HTMLElement>('#legend-items .legend-item'));

export function initLegendSearch(cb: ILegendSearchCallbacks): void {
    callbacks = cb;
    const input = inputEl();

    input.addEventListener('input', () => {
        current = 0;
        update(true);
    });
    input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!matches.length) return;
            const step = e.key === 'ArrowDown' ? 1 : -1;
            current = (current + step + matches.length) % matches.length;
            update(true);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const key = matches[current];
            if (key) callbacks?.onToggle(key);
        } else if (e.key === 'Escape') {
            // Иначе document-обработчик Escape снимет все закрепления
            e.stopPropagation();
            if (input.value) { input.value = ''; update(true); }
            else input.blur();
        }
    });
    input.addEventListener('focus', () => callbacks?.onPreview(matches[current] ?? null));
    input.addEventListener('blur',  () => callbacks?.onPreview(null));
}

export function focusLegendSearch(): void {
    const input = inputEl();
    input.focus();
    input.select();
}

/** После перестройки легенды: заново находим совпадения, оставаясь на том же участнике. */
export function refreshLegendSearch(): void {
    const key = matches[current];
    update(false);
    const idx = key ? matches.indexOf(key) : -1;
    if (idx >= 0 && idx !== current) { current = idx; update(false); }
}

function update(jump: boolean): void {
    const q   = inputEl().value.trim().toLowerCase();
    const all = items();
    matches   = [];
    for (const item of all) {
        const hit = !!q && (item.textContent ?? '').toLowerCase().includes(q);
        item.classList.toggle('search-hit', hit);
        item.classList.remove('search-current');
        if (hit) matches.push(item.dataset['driverKey']!);
    }
    if (current >= matches.length) current = 0;

    const count = countEl();
    count.textContent = !q ? '' : matches.length ? `${current + 1}/${matches.length}` : i18n.t().legendSearchNone;
    count.classList.toggle('none', !!q && !matches.length);

    const key  = matches[current] ?? null;
    const item = key ? all.find(i => i.dataset['driverKey'] === key) : undefined;
    item?.classList.add('search-current');
    if (!jump) return;
    if (item) scrollIntoLegend(item);
    if (document.activeElement === inputEl()) callbacks?.onPreview(key);
}

/** Прокрутка только внутри легенды (scrollIntoView сдвинул бы и страницу на телефоне). */
function scrollIntoLegend(item: HTMLElement): void {
    const inner = document.getElementById('legend-inner')!;
    const ir = inner.getBoundingClientRect();
    const r  = item.getBoundingClientRect();
    inner.scrollBy({
        top:  r.top  - ir.top  - ir.height / 2 + r.height / 2,
        left: r.left - ir.left - ir.width  / 2 + r.width  / 2,
        behavior: 'smooth',
    });
}
