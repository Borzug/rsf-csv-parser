import type { IStageInfo } from '../../shared/types';

/** Комментарий участника в точке графика. */
export interface IChartComment {
    key:       string;
    name:      string;
    color:     string;
    stageIdx:  number;
    stageNum:  number;
    stageName: string;
    /** Индекс точки на графике (для подсветки). */
    ptIdx:     number;
    /** Накопленное время в этой точке — для порядка по месту. */
    abs:       number | null;
    text:      string;
}

/** Индекс СУ по индексу точки графика (0 — старт, затем по три точки на СУ). */
export function stageIdxOfPoint(ptIdx: number): number {
    return Math.floor((ptIdx - 1) / 3);
}

/**
 * СУ, к которому относится комментарий в точке. Комментарий к сходу висит на последней
 * пройденной точке — она бывает на предыдущем СУ.
 */
function commentStageIdx(ds: any, ptIdx: number): number {
    return ptIdx === ds._dnfCmtPtIdx && ds._dnfCmtStageIdx !== null
        ? ds._dnfCmtStageIdx
        : stageIdxOfPoint(ptIdx);
}

/**
 * Комментарии набора участников. Источник — закреплённые, а если их нет — все показанные
 * (то же правило у счётчиков 💬 под осью и у списка на СУ).
 */
export function commentSourceIdxs(chart: any, pinnedIdxs: number[]): number[] {
    if (pinnedIdxs.length) return pinnedIdxs;
    const out: number[] = [];
    chart.data.datasets.forEach((ds: any, i: number) => { if (!ds.hidden) out.push(i); });
    return out;
}

export function collectComments(
    chart:    any,
    stages:   IStageInfo[],
    dsIdxs:   number[],
    stageIdx: number | null = null,
): IChartComment[] {
    const out: IChartComment[] = [];
    for (const di of dsIdxs) {
        const ds   = chart.data.datasets[di];
        if (!ds || ds.hidden) continue;
        const cmts = ds._cmts as string[];
        for (let i = 1; i < cmts.length; i++) {
            if (!cmts[i]) continue;
            const si = commentStageIdx(ds, i);
            if (stageIdx !== null && si !== stageIdx) continue;
            const st = stages[si];
            if (!st) continue;
            out.push({
                key:       ds.driverKey,
                name:      ds._displayName || ds.driverKey,
                color:     ds.borderColor,
                stageIdx:  si,
                stageNum:  st.num,
                stageName: st.name,
                ptIdx:     i,
                abs:       (ds._abs as (number | null)[])[i] ?? null,
                text:      cmts[i],
            });
        }
    }
    return out;
}

/** Число комментариев на каждом СУ у источника (закреплённые или все показанные). */
export function countCommentsByStage(chart: any, nStages: number, dsIdxs: number[]): number[] {
    const counts = new Array<number>(nStages).fill(0);
    for (const di of dsIdxs) {
        const ds = chart.data.datasets[di];
        if (!ds || ds.hidden) continue;
        const cmts = ds._cmts as string[];
        for (let i = 1; i < cmts.length; i++) {
            if (cmts[i]) counts[commentStageIdx(ds, i)]++;
        }
    }
    return counts;
}
