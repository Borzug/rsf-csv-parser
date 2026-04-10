import type { IParsedRallyData } from '../../shared/types';
import type { IDriverStats, IDriverStageSnap, IDriverResult } from './types';
import { nullableCompare } from '../utils';

export function computeAllDriverStats(
    data:      IParsedRallyData,
    recordMap: Map<string, Map<number, any>>,
): IDriverStats[] {
    const stages = [...data.stages].sort((a, b) => a.num - b.num);
    return data.drivers.map(drv => {
        const snaps: IDriverStageSnap[] = [];
        let total: number | null = 0;
        let sr = 0;
        let totalPen = 0;

        for (const st of stages) {
            const r    = recordMap.get(drv.username)?.get(st.num);
            const t3   = r?.time3 ?? null;
            const hasSR = r?.superRally ?? false;
            const pen  = (r?.penalty ?? 0) + (r?.servicePenalty ?? 0);
            snaps.push({ time3: t3, hasSR, penalty: r?.penalty ?? 0, servicePenalty: r?.servicePenalty ?? 0 });
            if (t3 === null) total = null;
            else if (total !== null) total += t3;
            if (hasSR) sr++;
            totalPen += pen;
        }

        const dn = drv.realName && drv.realName !== drv.username
            ? `${drv.username} | ${drv.realName}`
            : drv.username;

        return {
            username:     drv.username,
            realName:     drv.realName,
            car:          drv.car,
            group:        drv.group,
            displayName:  dn,
            totalTime:    total,
            totalPenalty: totalPen,
            srCount:      sr,
            snaps,
        };
    });
}

export function recalculateStatsForStages(
    stats:         IDriverStats,
    stageNums:     Set<number>,
    allStageNums:  number[],
    recordMap:     Map<string, Map<number, any>>,
): IDriverStats {
    if (stageNums.size === allStageNums.length) return stats;

    const filteredStages = allStageNums.filter(n => stageNums.has(n)).sort((a, b) => a - b);
    let total: number | null = 0;
    let sr = 0;
    let totalPen = 0;
    const snaps: IDriverStageSnap[] = [];

    for (const sn of filteredStages) {
        const r    = recordMap.get(stats.username)?.get(sn);
        const t3   = r?.time3 ?? null;
        const hasSR = r?.superRally ?? false;
        const pen  = (r?.penalty ?? 0) + (r?.servicePenalty ?? 0);
        snaps.push({ time3: t3, hasSR, penalty: r?.penalty ?? 0, servicePenalty: r?.servicePenalty ?? 0 });
        if (t3 === null) total = null;
        else if (total !== null) total += t3;
        if (hasSR) sr++;
        totalPen += pen;
    }

    return { ...stats, totalTime: total, totalPenalty: totalPen, srCount: sr, snaps };
}

export function computeDriverResults(stats: IDriverStats[]): IDriverResult[] {
    const n      = stats[0]?.snaps.length ?? 0;
    const sorted = [...stats].sort((a, b) => nullableCompare(a.totalTime, b.totalTime));

    return sorted.map((cur, i) => {
        const leader = sorted[0];
        const prev   = i > 0 ? sorted[i - 1] : null;
        const totalGap = cur.totalTime !== null && leader.totalTime !== null
            ? cur.totalTime - leader.totalTime
            : null;

        const glArr:    number[] = [];
        const ppArr:    number[] = [];
        const clArr:    number[] = [];
        const cpArr:    number[] = [];

        for (let s = 0; s < n; s++) {
            const ct = cur.snaps[s].time3;
            const lt = leader.snaps[s].time3;
            if (ct !== null && lt !== null) {
                glArr.push(ct - lt);
                if (!cur.snaps[s].hasSR && !leader.snaps[s].hasSR) clArr.push(ct - lt);
            }
            if (prev) {
                const pt = prev.snaps[s].time3;
                if (ct !== null && pt !== null) {
                    ppArr.push(ct - pt);
                    if (!cur.snaps[s].hasSR && !prev.snaps[s].hasSR) cpArr.push(ct - pt);
                }
            }
        }

        return {
            stats:              cur,
            position:           i + 1,
            totalGap,
            avgGapFromLeader:   glArr.length  ? avg(glArr)  : null,
            avgGapFromPrev:     ppArr.length   ? avg(ppArr)  : null,
            cleanGapFromLeader: clArr.length   ? avg(clArr)  : null,
            cleanGapFromPrev:   cpArr.length   ? avg(cpArr)  : null,
            cleanCountLeader:   clArr.length,
            cleanCountPrev:     cpArr.length,
            totalStageCount:    n,
        };
    });
}

function avg(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
