/**
 * Набор «активных» датасетов, которые рисуются ярко (остальные приглушены).
 * null — ничего не выделено, все линии рисуются как обычно.
 */
function resolveActiveIdxs(
    ch:             any,
    getHoveredKey:  () => string | null,
    getPinnedIdxs:  () => number[],
    getHoveredIdx:  () => number | null,
): Set<number> | null {
    const key = getHoveredKey();
    if (key !== null)
        return new Set([ch.data.datasets.findIndex((d: any) => d.driverKey === key) as number]);
    const pinned = getPinnedIdxs();
    if (pinned.length) return new Set(pinned);
    const hovered = getHoveredIdx();
    return hovered !== null ? new Set([hovered]) : null;
}

export function buildHoverDimPlugin(
    getHoveredKey:  () => string | null,
    getPinnedIdxs:  () => number[],
    getHoveredIdx:  () => number | null,
    getDimAlpha:    () => number,
): object {
    let active: Set<number> | null = null;

    return {
        id: 'hoverDim',
        beforeDatasetsDraw(ch: any): void {
            active = resolveActiveIdxs(ch, getHoveredKey, getPinnedIdxs, getHoveredIdx);
        },
        beforeDatasetDraw(ch: any, args: any): void {
            if (ch.data.datasets[args.index]?.hidden) return;
            if (active === null || active.has(args.index)) return;
            ch.ctx.save();
            ch.ctx.globalAlpha = getDimAlpha();
        },
        afterDatasetDraw(ch: any, args: any): void {
            if (ch.data.datasets[args.index]?.hidden) return;
            if (active === null || active.has(args.index)) return;
            ch.ctx.restore();
        },
    };
}
