import type { IStageInfo } from '../../shared/types';
import { commentStageIdx } from "./chartComments";
import { chartTheme } from "./theme";

/**
 * Комментарии закреплённых на графике: над каждым ◆ — плашка с номером СУ, сам текст —
 * в ленте под графиком (commentStrip). Комментарий, на который навели в ленте, обводится.
 * Наведение на ◆ закреплённого сообщается наружу, чтобы лента подсветила запись.
 */
const FONT_SIZE  = 9;
const PILL_H     = 13;
const PILL_PAD_X = 4;
const PILL_GAP   = 9;
const RING_R     = 10;
const HOVER_PX   = 14;

export interface IActiveComment { key: string; ptIdx: number }

export function buildPinnedCommentsPlugin(
    getPinnedIdxs:    () => number[],
    getStages:        () => IStageInfo[],
    getActive:        () => IActiveComment | null,
    onPointHover:     (c: IActiveComment | null) => void,
): object {
    let lastHover: string | null = null;

    return {
        id: 'pinnedComments',
        afterDatasetsDraw(ch: any): void {
            const pinnedIdxs = getPinnedIdxs();
            if (!pinnedIdxs.length) return;
            const stages = getStages();
            const active = getActive();
            const { ctx, chartArea: area } = ch;
            ctx.save();
            ctx.font         = `bold ${FONT_SIZE}px ${chartTheme().font}`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';

            for (const di of pinnedIdxs) {
                const ds = ch.data.datasets[di];
                if (!ds || ds.hidden) continue;
                const cmts = ds._cmts as string[];
                const pts  = ch.getDatasetMeta(di).data as any[];
                for (let i = 1; i < cmts.length; i++) {
                    const pt = pts[i];
                    if (!cmts[i] || !pt || pt.skip) continue;
                    if (pt.y < area.top - 1 || pt.y > area.bottom + 1) continue;

                    const si    = commentStageIdx(ds, i);
                    const label = stages[si] ? String(stages[si].num) : '';
                    const w     = ctx.measureText(label).width + PILL_PAD_X * 2;
                    // Над точкой, а у верхнего края — под ней
                    const above = pt.y - PILL_GAP - PILL_H >= area.top;
                    const y     = above ? pt.y - PILL_GAP - PILL_H / 2 : pt.y + PILL_GAP + PILL_H / 2;

                    ctx.fillStyle   = chartTheme().pillBg;
                    ctx.strokeStyle = ds.borderColor;
                    ctx.lineWidth   = 1;
                    ctx.beginPath();
                    ctx.roundRect(pt.x - w / 2, y - PILL_H / 2, w, PILL_H, 3);
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = chartTheme().pillText;
                    ctx.fillText(label, pt.x, y + 0.5);

                    if (active && active.key === ds.driverKey && active.ptIdx === i) {
                        ctx.strokeStyle = chartTheme().highlight;
                        ctx.lineWidth   = 2;
                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, RING_R, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
        },

        afterEvent(ch: any, args: any): void {
            const type = args.event.type;
            if (type !== 'mousemove' && type !== 'mouseout') return;
            let hit: IActiveComment | null = null;
            if (type === 'mousemove') {
                const pinned = getPinnedIdxs();
                const el     = ch.getActiveElements()[0];
                // Активной Chart.js считает ближайшую точку, даже далёкую — нужна реальная близость
                const near = el && Math.hypot(el.element.x - args.event.x, el.element.y - args.event.y) <= HOVER_PX;
                if (near && pinned.includes(el.datasetIndex)) {
                    const ds = ch.data.datasets[el.datasetIndex];
                    if ((ds._cmts as string[])[el.index]) hit = { key: ds.driverKey, ptIdx: el.index };
                }
            }
            const sig = hit ? `${hit.key}\n${hit.ptIdx}` : null;
            if (sig === lastHover) return;
            lastHover = sig;
            onPointHover(hit);
        },
    };
}
