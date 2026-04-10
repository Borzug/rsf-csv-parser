export function buildHoverDimPlugin(
    getHoveredKey:  () => string | null,
    getPinnedIdx:   () => number | null,
    getHoveredIdx:  () => number | null,
): object {
    function resolveActiveIdx(ch: any): number | null {
        const key = getHoveredKey();
        if (key !== null)
            return ch.data.datasets.findIndex((d: any) => d.driverKey === key) as number;
        const pinned = getPinnedIdx();
        if (pinned !== null) return pinned;
        return getHoveredIdx();
    }

    return {
        id: 'hoverDim',
        beforeDatasetDraw(ch: any, args: any): void {
            if (ch.data.datasets[args.index]?.hidden) return;
            const activeIdx = resolveActiveIdx(ch);
            if (activeIdx === null || args.index === activeIdx) return;
            ch.ctx.save();
            ch.ctx.globalAlpha = 0.06;
        },
        afterDatasetDraw(ch: any, args: any): void {
            if (ch.data.datasets[args.index]?.hidden) return;
            const activeIdx = resolveActiveIdx(ch);
            if (activeIdx === null || args.index === activeIdx) return;
            ch.ctx.restore();
        },
    };
}
