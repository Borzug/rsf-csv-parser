/**
 * Название ралли с rallysimfans.hu через веб-приложение Google Apps Script
 * (развёрнуто отдельно, в репозиторий не входит). Браузер не может прочитать
 * страницу rallysimfans напрямую: сайт не отдаёт CORS-заголовков.
 * Ожидаемый ответ: GET …/exec?rally=105003 → {"name": "…"} или {"name": null}.
 *
 * Наружу уходит только номер ралли. Ответ — обычный текст, в страницу
 * вставляется только через textContent.
 */

/** Адрес развёрнутого веб-приложения (…/exec). Пусто — функция выключена. */
export const RALLY_NAME_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbwv4wdJpWe-Zpuwm9_CW34_r4002VgWxB_u3yxm2LgEbR-KvFNhWhwPQwuJ3T9plpY7pQ/exec';

const STORAGE_PREFIX = 'rsf-rally-name:';
const TIMEOUT_MS     = 8000;
const MAX_NAME_LEN   = 120;

/** Сохранённое ранее название — чтобы показать его сразу, без запроса. */
export function getCachedRallyName(rallyId: string): string | null {
    try {
        return localStorage.getItem(STORAGE_PREFIX + rallyId);
    } catch {
        return null;
    }
}

/** null — функция выключена, ралли не найдено или сервис недоступен. */
export async function fetchRallyName(rallyId: string): Promise<string | null> {
    if (!RALLY_NAME_ENDPOINT || !/^\d{1,9}$/.test(rallyId)) return null;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${RALLY_NAME_ENDPOINT}?rally=${rallyId}`, { signal: ctrl.signal });
        if (!res.ok) return null;
        const body = await res.json() as { name?: unknown };
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME_LEN) : '';
        if (!name) return null;
        try { localStorage.setItem(STORAGE_PREFIX + rallyId, name); } catch { /* приватный режим */ }
        return name;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}
