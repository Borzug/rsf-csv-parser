const DIM_ALPHA    = 0.06;
const DNF_DASH_ON  = 6;
const DNF_DASH_OFF = 4;
const DNF_LINE_W   = 1.8;

export function buildDnfLinePlugin(
    getHoveredKey: () => string | null,
    getPinnedIdx:  () => number | null,
    getHoveredIdx: () => number | null,
): object {
    function resolveActiveIdx(chart: any): number | null {
        const key = getHoveredKey();
        if (key !== null)
            return chart.data.datasets.findIndex((d: any) => d.driverKey === key) as number;
        const pinned = getPinnedIdx();
        if (pinned !== null) return pinned;
        return getHoveredIdx();
    }

    return {
        id: 'dnfLine',
        afterDatasetsDraw(chart: any): void {
            const pinnedIdx = getPinnedIdx();
            const activeIdx = resolveActiveIdx(chart);
            const { ctx }   = chart;

            chart.data.datasets.forEach((ds: any, di: number) => {
                if (ds.hidden) return;
                if (di === pinnedIdx) return;

                const dnfPtIdx  = ds._dnfCommentPtIdx as number | null;
                const lastPtIdx = ds._lastValidPtIdx  as number | undefined;
                if (dnfPtIdx == null || lastPtIdx == null) return;

                const meta   = chart.getDatasetMeta(di);
                const fromPt = meta.data[lastPtIdx];
                const toPt   = meta.data[dnfPtIdx];
                if (!fromPt || !toPt) return;

                const isDimmed = activeIdx !== null && di !== activeIdx;

                ctx.save();
                if (isDimmed) ctx.globalAlpha = DIM_ALPHA;
                ctx.beginPath();
                ctx.setLineDash([DNF_DASH_ON, DNF_DASH_OFF]);
                ctx.strokeStyle = ds.borderColor as string;
                ctx.lineWidth   = DNF_LINE_W;
                ctx.moveTo(fromPt.x, fromPt.y);
                ctx.lineTo(toPt.x,   toPt.y);
                ctx.stroke();
                ctx.restore();
            });
        },
    };
}
