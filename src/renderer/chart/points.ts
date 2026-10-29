/**
 * Ось X графика: точка 0 — старт, дальше на каждый СУ по три точки (SP1, SP2, финиш).
 * Вся арифметика индексов точек и делений оси — здесь.
 */
export const POINTS_PER_STAGE = 3;

/** Число точек на оси для набора СУ. */
export function pointCount(nStages: number): number {
    return 1 + nStages * POINTS_PER_STAGE;
}

/** Деление оси, с которого начинается СУ (финиш предыдущего). */
export function stageStartTick(stageIdx: number): number {
    return stageIdx * POINTS_PER_STAGE;
}

/** Деление оси на финише СУ. */
export function stageEndTick(stageIdx: number): number {
    return (stageIdx + 1) * POINTS_PER_STAGE;
}

/** Индекс СУ (в наборе на графике), к которому относится точка; для старта — -1. */
export function stageIdxOfPoint(ptIdx: number): number {
    return Math.floor((ptIdx - 1) / POINTS_PER_STAGE);
}

/** Номер сплита точки внутри СУ: 1 — SP1, 2 — SP2, 3 — финиш. */
export function splitOfPoint(ptIdx: number): number {
    return (ptIdx - 1) % POINTS_PER_STAGE + 1;
}

/** Точка — финиш СУ (а не промежуточный сплит и не старт). */
export function isStageFinish(ptIdx: number): boolean {
    return ptIdx > 0 && ptIdx % POINTS_PER_STAGE === 0;
}
