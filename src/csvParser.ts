import type { ILapRecord, IStageInfo, IDriverInfo, IParsedRallyData } from './shared/types';

const COLUMN_ALIASES: Record<string, string[]> = {
    stageNum:       ['ss'],
    stageName:      ['stage name', 'stage_name', 'stagename'],
    username:       ['user name', 'username', 'user_name', 'login', 'nick'],
    realName:       ['real name', 'real_name', 'realname', 'full name', 'driver name'],
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

function decodeHtmlEntities(str: string): string {
    if (!str || !str.includes('&#')) return str;
    let result = str.replace(/&#(\d+);/g, (_, code) =>
        String.fromCodePoint(parseInt(code, 10)),
    );
    result = result.replace(/&#(\d+)(?=[&#]|$)/g, (_, code) =>
        String.fromCodePoint(parseInt(code, 10)),
    );
    result = result.replace(/&#(\d+)/g, (_, code) =>
        String.fromCodePoint(parseInt(code, 10)),
    );
    return result;
}

function detectDelimiter(line: string): string {
    const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
    for (const ch of line) if (ch in counts) counts[ch]++;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitRow(row: string, delimiter: string): string[] {
    const result: string[] = [];
    let current  = '';
    let inQuote  = false;
    let quoteChar = '';

    for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (!inQuote && (ch === '"' || ch === "'")) {
            inQuote = true; quoteChar = ch;
        } else if (inQuote && ch === quoteChar) {
            if (row[i + 1] === quoteChar) { current += ch; i++; }
            else inQuote = false;
        } else if (!inQuote && ch === delimiter) {
            result.push(current.trim()); current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
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
    if (lines.length < 2) throw new Error('Файл содержит слишком мало строк');

    const delim  = detectDelimiter(lines[0]);
    const colMap = buildColumnMap(splitRow(lines[0], delim));

    const get = (row: string[], field: string): string | undefined => {
        const idx = colMap[field];
        return idx !== undefined && idx < row.length ? row[idx] : undefined;
    };

    const records: ILapRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const row      = splitRow(lines[i], delim);
        if (row.every(c => c === '')) continue;
        const stageNum = parseInt(get(row, 'stageNum') ?? '', 10);
        if (isNaN(stageNum)) continue;

        records.push({
            stageNum,
            stageName:      decodeHtmlEntities(get(row, 'stageName') ?? `SS${stageNum}`),
            username:       decodeHtmlEntities(get(row, 'username')  ?? `driver_${i}`),
            realName:       decodeHtmlEntities(get(row, 'realName')  ?? ''),
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

    if (records.length === 0) throw new Error('Не удалось распознать данные в файле');

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
            const realPart = r.realName && r.realName !== r.username ? ` (${r.realName})` : '';
            const carPart  = r.car ? ` | ${r.car}` : '';
            driverMap.set(r.username, {
                username: r.username,
                realName: r.realName,
                car:      r.car,
                group:    r.group,
                label:    `${r.username}${realPart}${carPart}`,
            });
        }
    }
    const drivers = [...driverMap.values()].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    );

    const groups = [...new Set(records.map(r => r.group).filter(Boolean))].sort();
    return { records, stages, drivers, groups };
}
