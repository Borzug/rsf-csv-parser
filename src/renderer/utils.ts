import { i18n } from '../i18n/index';

export function formatTime(sec: number | null): string {
    if (sec === null || isNaN(sec)) return i18n.t().dnf;
    const tenths = Math.round(Math.abs(sec) * 10);
    const h = Math.floor(tenths / 36000);
    const m = Math.floor((tenths % 36000) / 600);
    const s = Math.floor((tenths % 600) / 10);
    const d = tenths % 10;
    const sign = sec < 0 && tenths > 0 ? '-' : '';
    const ss = `${String(s).padStart(2, '0')}.${d}`;
    return h > 0
        ? `${sign}${h}:${String(m).padStart(2, '0')}:${ss}`
        : `${sign}${m}:${ss}`;
}

export function formatTimeSigned(sec: number | null): string {
    if (sec === null) return '—';
    return (sec >= 0 ? '+' : '') + formatTime(sec);
}

export function formatYAxisTick(sec: number, units: { h: string; m: string; s: string }): string {
    if (sec === 0) return '0';
    const a = Math.abs(sec);
    const h = Math.floor(a / 3600);
    const m = Math.floor((a % 3600) / 60);
    const s = Math.floor(a % 60);
    const parts: string[] = [];
    if (h) parts.push(`${h}${units.h}`);
    if (m) parts.push(`${m}${units.m}`);
    if (s) parts.push(`${s}${units.s}`);
    return parts.length ? (sec < 0 ? '-' : '') + parts.join(' ') : '0';
}

export function computeYAxisStep(maxSec: number): number {
    if (maxSec <= 0) return 60;
    const target = maxSec / 7;
    const steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800];
    return steps.find(v => v >= target) ?? 28800;
}

/** Основное устройство ввода — палец (телефон, планшет): нет наведения и клавиш-модификаторов. */
export function isCoarsePointer(): boolean {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Пауза после ввода в поле поиска, прежде чем искать (меньше — дёргается на каждой букве). */
export const SEARCH_DEBOUNCE_MS = 200;

/** Отложенный вызов; cancel — отменить ожидающий (поле очистили или закрыли раньше срока). */
export interface IDebounced<A extends unknown[]> {
    (...args: A): void;
    cancel(): void;
}

/** Вызывает fn через ms после последнего вызова обёртки. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): IDebounced<A> {
    let timer: number | undefined;
    const wrapped = (...args: A) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), ms);
    };
    wrapped.cancel = () => window.clearTimeout(timer);
    return wrapped;
}

export function nullableCompare(a: number | null, b: number | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
}

/** Время в миллисекундах: суммы с плавающей точкой, равные на табло, могут отличаться на 1e-13. */
export function timeKey(sec: number): number {
    return Math.round(sec * 1000);
}

/**
 * Места по списку, уже упорядоченному по времени: равное время — равное место (1, 2, 2, 4).
 * null — нет времени (сошёл).
 */
export function rankSorted<T>(sorted: T[], time: (item: T) => number | null): (number | null)[] {
    const ranks: (number | null)[] = [];
    sorted.forEach((item, i) => {
        const t    = time(item);
        const prev = i > 0 ? time(sorted[i - 1]) : null;
        ranks.push(t === null ? null
            : prev !== null && timeKey(prev) === timeKey(t) ? ranks[i - 1] : i + 1);
    });
    return ranks;
}
