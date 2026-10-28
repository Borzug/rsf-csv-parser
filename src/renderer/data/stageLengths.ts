/**
 * Длина трасс по таблице rallysimfans.hu/rbr/stages.php (ID, название, км).
 * В CSV есть только название СУ, поэтому ищем по нему; ралли со своими
 * названиями СУ (например, «Cumbre 1») сюда не попадут — у них длины нет.
 */
import STAGES from './stages.json';

interface IStageRow {
    id:   number;
    name: string;
    km:   number;
}

/** Регистр, лишние пробелы и диакритика («Lucéram» / «Luceram») не важны. */
function normalize(name: string): string {
    return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const BY_NAME = new Map<string, number>(
    (STAGES as IStageRow[]).map(s => [normalize(s.name), s.km]),
);

/** Длина СУ в км или null, если трасса не найдена. */
export function stageLengthKm(name: string): number | null {
    return BY_NAME.get(normalize(name)) ?? null;
}
