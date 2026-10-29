import type { IParsedRallyData, TRecordMap } from '../../shared/types';
import type { IDriverStats, IDriverStageSnap, IDriverResult } from './types';
import { nullableCompare } from '../utils';

/** Итоги участника по набору СУ (в порядке номеров): время, штрафы, SR и данные по каждому СУ. */
function summarizeStages(
    username:  string,
    stageNums: number[],
    recordMap: TRecordMap,
): Pick<IDriverStats, 'totalTime' | 'totalPenalty' | 'srCount' | 'snaps'> {
    const snaps: IDriverStageSnap[] = [];
    let total: number | null = 0;
    let sr = 0;
    let totalPen = 0;

    for (const sn of stageNums) {
        const r              = recordMap.get(username)?.get(sn);
        const t3             = r?.time3 ?? null;
        const hasSR          = r?.superRally ?? false;
        const penalty        = r?.penalty ?? 0;
        const servicePenalty = r?.servicePenalty ?? 0;
        snaps.push({ time3: t3, hasSR, penalty, servicePenalty });
        if (t3 === null) total = null;
        else if (total !== null) total += t3;
        if (hasSR) sr++;
        totalPen += penalty + servicePenalty;
    }
    return { totalTime: total, totalPenalty: totalPen, srCount: sr, snaps };
}

export function computeAllDriverStats(
    data:      IParsedRallyData,
    recordMap: TRecordMap,
): IDriverStats[] {
    const stageNums = data.stages.map(s => s.num).sort((a, b) => a - b);
    return data.drivers.map(drv => ({
        username: drv.username,
        realName: drv.realName,
        country:  drv.country,
        car:      drv.car,
        group:    drv.group,
        ...summarizeStages(drv.username, stageNums, recordMap),
    }));
}

export function recalculateStatsForStages(
    stats:         IDriverStats,
    stageNums:     Set<number>,
    allStageNums:  number[],
    recordMap:     TRecordMap,
): IDriverStats {
    if (stageNums.size === allStageNums.length) return stats;
    const filtered = allStageNums.filter(n => stageNums.has(n)).sort((a, b) => a - b);
    return { ...stats, ...summarizeStages(stats.username, filtered, recordMap) };
}

/**
 * stageKm — длины СУ в порядке snaps: темп считается как отставание на километр
 * (сумма отставаний / сумма км). Без длин — среднее отставание за СУ.
 */
export function computeDriverResults(stats: IDriverStats[], stageKm: number[] | null = null): IDriverResult[] {
    const n      = stats[0]?.snaps.length ?? 0;
    const weight = (s: number): number => stageKm ? stageKm[s] : 1;
    const sorted = [...stats].sort((a, b) => nullableCompare(a.totalTime, b.totalTime));

    return sorted.map((cur, i) => {
        const leader = sorted[0];
        const prev   = i > 0 ? sorted[i - 1] : null;
        const totalGap = cur.totalTime !== null && leader.totalTime !== null
            ? cur.totalTime - leader.totalTime
            : null;

        const gl = new PaceAcc();
        const pp = new PaceAcc();
        const cl = new PaceAcc();
        const cp = new PaceAcc();

        for (let s = 0; s < n; s++) {
            const w  = weight(s);
            const ct = cur.snaps[s].time3;
            const lt = leader.snaps[s].time3;
            if (ct !== null && lt !== null) {
                gl.add(ct - lt, w);
                if (!cur.snaps[s].hasSR && !leader.snaps[s].hasSR) cl.add(ct - lt, w);
            }
            if (prev) {
                const pt = prev.snaps[s].time3;
                if (ct !== null && pt !== null) {
                    pp.add(ct - pt, w);
                    if (!cur.snaps[s].hasSR && !prev.snaps[s].hasSR) cp.add(ct - pt, w);
                }
            }
        }

        return {
            stats:              cur,
            position:           i + 1,
            totalGap,
            avgGapFromLeader:   gl.value(),
            avgGapFromPrev:     pp.value(),
            cleanGapFromLeader: cl.value(),
            cleanGapFromPrev:   cp.value(),
            cleanCountLeader:   cl.count,
            cleanCountPrev:     cp.count,
            totalStageCount:    n,
        };
    });
}

/** Взвешенное среднее отставание: вес — длина СУ в км (или 1 — «за участок»). */
class PaceAcc {
    private gap    = 0;
    private weight = 0;
    count = 0;

    add(gap: number, weight: number): void {
        this.gap    += gap;
        this.weight += weight;
        this.count++;
    }

    value(): number | null {
        return this.count ? this.gap / this.weight : null;
    }
}
