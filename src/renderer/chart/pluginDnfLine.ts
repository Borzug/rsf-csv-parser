import { resolveActiveIdxs } from "./pluginHoverDim";

const DNF_DASH_ON  = 6;
const DNF_DASH_OFF = 4;
const DNF_LINE_W   = 1.8;

export function buildDnfLinePlugin(
    getHoveredKey: () => string | null,
    getPinnedIdxs: () => number[],
    getHoveredIdx: () => number | null,
    getDimAlpha:   () => number,
): object {
    return {
        id: 'dnfLine',
        afterDatasetsDraw(chart: any): void {
            const pinnedIdxs = getPinnedIdxs();
            const active     = resolveActiveIdxs(chart, getHoveredKey, getPinnedIdxs, getHoveredIdx);
            const { ctx }    = chart;

            chart.data.datasets.forEach((ds: any, di: number) => {
                if (ds.hidden) return;
                if (pinnedIdxs.includes(di)) return;

                const dnfPtIdx  = ds._dnfCommentPtIdx as number | null;
                const lastPtIdx = ds._lastValidPtIdx  as number | undefined;
                if (dnfPtIdx == null || lastPtIdx == null) return;

                const meta   = chart.getDatasetMeta(di);
                const fromPt = meta.data[lastPtIdx];
                const toPt   = meta.data[dnfPtIdx];
                if (!fromPt || !toPt) return;

                const isDimmed = active !== null && !active.has(di);

                ctx.save();
                if (isDimmed) ctx.globalAlpha = getDimAlpha();
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
