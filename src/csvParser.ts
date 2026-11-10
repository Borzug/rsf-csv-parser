import type { ILapRecord, IStageInfo, IDriverInfo, IParsedRallyData } from './shared/types';
import { driverDisplayName } from './shared/driverName';

/** Почему файл не разобран; текст сообщения выбирает интерфейс по коду (i18n). */
export type TCsvErrorCode = 'tooFewLines' | 'noData' | 'missingColumns';

export class CsvParseError extends Error {
    constructor(readonly code: TCsvErrorCode) {
        super(code);
    }
}

const COLUMN_ALIASES: Record<string, string[]> = {
    stageNum:       ['ss'],
    stageName:      ['stage name', 'stage_name', 'stagename'],
    username:       ['user name', 'username', 'user_name', 'login', 'nick'],
    realName:       ['real name', 'real_name', 'realname', 'full name', 'driver name'],
    country:        ['nationality', 'country', 'nation'],
    car:            ['car name', 'car', 'vehicle', 'car_name'],
    group:          ['group', 'class', 'category'],
    time1:          ['time1'],
    time2:          ['time2'],
    time3:          ['time3'],
    penalty:        ['penalty'],
    servicePenalty: ['service penalty', 'service_penalty', 'servicepenalty'],
    superRally:     ['super rally', 'super_rally', 'superrally', 'sr'],
    comment:        ['comment', 'comments', 'note', 'notes'],
};

const REQUIRED_COLUMNS = ['stageNum', 'username', 'time3'] as const;

const MAX_CODE_POINT = 0x10FFFF;

/** Числовые сущности (&#233; и обрезанные &#233 без «;»); недопустимый код оставляем как есть. */
function decodeHtmlEntities(str: string): string {
    if (!str || !str.includes('&#')) return str;
    return str.replace(/&#(\d+);?/g, (m, code) => {
        const n = parseInt(code, 10);
        return n > 0 && n <= MAX_CODE_POINT ? String.fromCodePoint(n) : m;
    });
}

function detectDelimiter(line: string): string {
    const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
    for (const ch of line) if (ch in counts) counts[ch]++;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Поле в кавычках, начинающееся с позиции start: значение и позиция за закрывающей кавычкой.
 * null — это не поле в кавычках: закрывающей нет или за ней не конец поля («"Tim" Smith»).
 */
function readQuotedField(
    row:       string,
    start:     number,
    delimiter: string,
): { value: string; end: number } | null {
    let value = '';
    for (let i = start + 1; i < row.length; i++) {
        if (row[i] !== '"') { value += row[i]; continue; }
        if (row[i + 1] === '"') { value += '"'; i++; continue; }
        const end = i + 1;
        return end === row.length || row[end] === delimiter ? { value, end } : null;
    }
    return null;
}

function readPlainField(row: string, start: number, delimiter: string): { value: string; end: number } {
    const next = row.indexOf(delimiter, start);
    const end  = next === -1 ? row.length : next;
    return { value: row.slice(start, end), end };
}

/**
 * Кавычкой считается только " в начале поля, и только если за закрывающей идёт разделитель
 * или конец строки; иначе поле читается как обычный текст (кавычки сохраняются).
 * Апострофы («Cote D'Arbroz») и кавычки внутри текста («Vinícius "Tim" Santos») — обычные символы.
 */
function splitRow(row: string, delimiter: string): string[] {
    const result: string[] = [];
    let pos = 0;
    while (true) {
        const field = (row[pos] === '"' ? readQuotedField(row, pos, delimiter) : null)
            ?? readPlainField(row, pos, delimiter);
        result.push(field.value.trim());
        if (field.end >= row.length) return result;
        pos = field.end + 1;
    }
}

function parseSecondsOrNull(raw: string | undefined): number | null {
    if (!raw || raw.trim() === '' || raw.trim() === '-') return null;
    const n = parseFloat(raw.trim().replace(',', '.'));
    return isNaN(n) ? null : n;
}

function parseSecondsOrZero(raw: string | undefined): number {
    return parseSecondsOrNull(raw) ?? 0;
}

function parseBoolFlag(raw: string | undefined): boolean {
    if (!raw) return false;
    const s = raw.trim();
    return s === '1' || s.toLowerCase() === 'true' || s.toLowerCase() === 'yes';
}

function buildColumnMap(headers: string[]): Record<string, number> {
    const normalized = headers.map(h => h.toLowerCase().trim());
    const map: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
            const idx = normalized.indexOf(alias);
            if (idx !== -1 && !(field in map)) { map[field] = idx; break; }
        }
    }
    return map;
}

export function parseCsvText(raw: string): IParsedRallyData {
    let text = raw;
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) throw new CsvParseError('tooFewLines');

    const delim  = detectDelimiter(lines[0]);
    const colMap = buildColumnMap(splitRow(lines[0], delim));
    // Без этих колонок нельзя ни связать строки с участником, ни посчитать время
    if (REQUIRED_COLUMNS.some(f => !(f in colMap))) throw new CsvParseError('missingColumns');

    const get = (row: string[], field: string): string | undefined => {
        const idx = colMap[field];
        return idx !== undefined && idx < row.length ? row[idx] : undefined;
    };

    const records: ILapRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const row      = splitRow(lines[i], delim);
        if (row.every(c => c === '')) continue;
        const stageNum = parseInt(get(row, 'stageNum') ?? '', 10);
        const username = decodeHtmlEntities(get(row, 'username') ?? '');
        if (isNaN(stageNum) || !username) continue;

        records.push({
            stageNum,
            stageName:      decodeHtmlEntities(get(row, 'stageName') || `SS${stageNum}`),
            username,
            realName:       decodeHtmlEntities(get(row, 'realName')  ?? ''),
            country:        (get(row, 'country') ?? '').toUpperCase(),
            car:            decodeHtmlEntities(get(row, 'car')       ?? ''),
            comment:        decodeHtmlEntities(get(row, 'comment')   ?? ''),
            group:          get(row, 'group')          ?? '',
            time1:          parseSecondsOrNull(get(row, 'time1')),
            time2:          parseSecondsOrNull(get(row, 'time2')),
            time3:          parseSecondsOrNull(get(row, 'time3')),
            penalty:        parseSecondsOrZero(get(row, 'penalty')),
            servicePenalty: parseSecondsOrZero(get(row, 'servicePenalty')),
            superRally:     parseBoolFlag(get(row, 'superRally')),
        });
    }

    if (records.length === 0) throw new CsvParseError('noData');

    return buildRallyData(records);
}

function buildRallyData(records: ILapRecord[]): IParsedRallyData {
    const stageMap = new Map<number, string>();
    for (const r of records) {
        if (!stageMap.has(r.stageNum)) stageMap.set(r.stageNum, r.stageName);
    }
    const stages: IStageInfo[] = [...stageMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([num, name]) => ({ num, name }));

    const driverMap = new Map<string, IDriverInfo>();
    for (const r of records) {
        if (!driverMap.has(r.username)) {
            const carPart  = r.car ? ` | ${r.car}` : '';
            driverMap.set(r.username, {
                username: r.username,
                realName: r.realName,
                country:  r.country,
                car:      r.car,
                group:    r.group,
                label:    `${driverDisplayName(r)}${carPart}`,
            });
        }
    }
    const drivers = [...driverMap.values()].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    );

    const groups = [...new Set(records.map(r => r.group).filter(Boolean))].sort();
    const cars   = [...new Set(drivers.map(d => d.car).filter(Boolean))].sort();
    const countrySet = new Set(drivers.map(d => d.country));
    // Без колонки Nationality у всех '' — фильтр по стране не нужен
    const countries = [...countrySet].some(Boolean) ? [...countrySet].sort() : [];
    return { records, stages, drivers, groups, cars, countries };
}
