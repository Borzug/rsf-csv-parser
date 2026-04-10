export function formatTime(sec: number | null): string {
    if (sec === null || isNaN(sec)) return 'DNF';
    const a = Math.abs(sec);
    const h = Math.floor(a / 3600);
    const m = Math.floor((a % 3600) / 60);
    const s = Math.floor(a % 60);
    const d = Math.round((a % 1) * 10);
    const sign = sec < 0 ? '-' : '';
    const ss = `${String(s).padStart(2, '0')}.${d}`;
    return h > 0
        ? `${sign}${h}:${String(m).padStart(2, '0')}:${ss}`
        : `${sign}${m}:${ss}`;
}

export function formatTimeSigned(sec: number | null): string {
    if (sec === null) return '—';
    return (sec >= 0 ? '+' : '') + formatTime(sec);
}

export function formatYAxisTick(sec: number): string {
    if (sec === 0) return '0';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const parts: string[] = [];
    if (h) parts.push(`${h}ч`);
    if (m) parts.push(`${m}м`);
    if (s) parts.push(`${s}с`);
    return parts.length ? parts.join(' ') : '0';
}

export function computeYAxisStep(maxSec: number): number {
    if (maxSec <= 0) return 60;
    const target = maxSec / 7;
    const steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800];
    return steps.find(v => v >= target) ?? 28800;
}

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function nullableCompare(a: number | null, b: number | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
}
