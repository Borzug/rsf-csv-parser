const FONT_FAMILY   = "'Fira Code', monospace";
const PAD_X         = 10;
const PAD_Y         = 7;
const LINE_H        = 17;
const FONT_SZ       = 12;
const STAGE_FONT_SZ = 10;
const MAX_BOX_W     = 280;
const BOX_GAP       = 6;

interface ICommentBox {
    x:        number;
    y:        number;
    w:        number;
    h:        number;
    cmtLines: string[];
    stage:    string;
}

interface IBoxEntry {
    bw:        number;
    bh:        number;
    cmtLines:  string[];
    stageLabel: string;
}

interface IAnchorGroup {
    pt:      any;
    entries: IBoxEntry[];
}

export function buildPinnedCommentsPlugin(
    getPinnedIdx: () => number | null,
): object {
    return {
        id: 'pinnedComments',
        afterDraw(ch: any): void {
            const pinnedIdx = getPinnedIdx();
            if (pinnedIdx === null) return;

            const ds = ch.data.datasets[pinnedIdx];
            if (!ds || ds.hidden) return;

            const cmts  = ds._cmts        as string[];
            const slbls = ds._stageLabels as string[];
            const meta  = ch.getDatasetMeta(pinnedIdx);
            const { ctx, chartArea } = ch;

            ctx.save();
            const boxes = collectCommentBoxes(ctx, ds, meta, cmts, slbls, chartArea);
            resolveCollisions(boxes, chartArea);
            renderBoxes(ctx, boxes);
            ctx.restore();
        },
    };
}

function wrapText(
    ctx:      CanvasRenderingContext2D,
    text:     string,
    maxWidth: number,
): string[] {
    const words  = text.split(' ');
    const lines: string[] = [];
    let current  = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            if (ctx.measureText(word).width > maxWidth) {
                let chunk = '';
                for (const ch of word) {
                    if (ctx.measureText(chunk + ch).width > maxWidth) {
                        lines.push(chunk);
                        chunk = ch;
                    } else {
                        chunk += ch;
                    }
                }
                current = chunk;
            } else {
                current = word;
            }
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
}

function measureBoxWidth(
    ctx:        CanvasRenderingContext2D,
    cmtLines:   string[],
    stageLabel: string,
): number {
    const innerW = MAX_BOX_W - PAD_X * 2;
    ctx.font = `${STAGE_FONT_SZ}px ${FONT_FAMILY}`;
    const stageW = stageLabel ? ctx.measureText(stageLabel).width : 0;
    ctx.font = `${FONT_SZ}px ${FONT_FAMILY}`;
    const maxLineW = Math.max(stageW, ...cmtLines.map(l => ctx.measureText(l).width));
    return Math.min(maxLineW + PAD_X * 2, MAX_BOX_W + PAD_X * 2, innerW + PAD_X * 2);
}

function buildAnchorGroups(
    ctx:       CanvasRenderingContext2D,
    ds:        any,
    meta:      any,
    cmts:      string[],
    slbls:     string[],
): Map<number, IAnchorGroup> {
    const innerW       = MAX_BOX_W - PAD_X * 2;
    const dnfPtIdx     = ds._dnfCommentPtIdx as number | null;
    const lastValidIdx = ds._lastValidPtIdx  as number;
    const groups       = new Map<number, IAnchorGroup>();

    meta.data.forEach((pt: any, i: number) => {
        const cmt = cmts[i];
        if (!cmt) return;

        const isDnfCmt  = i === dnfPtIdx;
        const anchorPt  = isDnfCmt ? meta.data[lastValidIdx] : pt;
        const anchorKey = isDnfCmt ? lastValidIdx : i;

        const stageLabel = (slbls[i] ?? '').split(' ').slice(0, 2).join(' ');

        ctx.font = `${FONT_SZ}px ${FONT_FAMILY}`;
        const cmtLines = wrapText(ctx, cmt, innerW);
        const bw       = measureBoxWidth(ctx, cmtLines, stageLabel);
        const stageLines = stageLabel ? 1 : 0;
        const bh = LINE_H * (stageLines + cmtLines.length) + PAD_Y * 2;

        if (!groups.has(anchorKey)) {
            groups.set(anchorKey, { pt: anchorPt, entries: [] });
        }
        groups.get(anchorKey)!.entries.push({ bw, bh, cmtLines, stageLabel });
    });

    return groups;
}

function positionGroupBoxes(
    group:     IAnchorGroup,
    chartArea: any,
): ICommentBox[] {
    const { pt, entries } = group;
    const boxes: ICommentBox[] = [];

    // Первый комментарий — внизу стека, каждый следующий выше него
    let bottomEdge = pt.y - 8;

    for (const entry of entries) {
        let bx = pt.x + 10;
        let by = bottomEdge - entry.bh;

        if (bx + entry.bw > chartArea.right) bx = pt.x - entry.bw - 10;
        if (bx < chartArea.left)             bx = chartArea.left + 2;
        if (by < chartArea.top)              by = chartArea.top + 2;
        if (by + entry.bh > chartArea.bottom) by = chartArea.bottom - entry.bh - 2;

        boxes.push({
            x: bx,
            y: by,
            w: entry.bw,
            h: entry.bh,
            cmtLines: entry.cmtLines,
            stage:    entry.stageLabel,
        });

        bottomEdge = by - BOX_GAP;
    }

    return boxes;
}

function collectCommentBoxes(
    ctx:       CanvasRenderingContext2D,
    ds:        any,
    meta:      any,
    cmts:      string[],
    slbls:     string[],
    chartArea: any,
): ICommentBox[] {
    const groups = buildAnchorGroups(ctx, ds, meta, cmts, slbls);
    const boxes: ICommentBox[] = [];

    groups.forEach(group => {
        boxes.push(...positionGroupBoxes(group, chartArea));
    });

    return boxes;
}

function resolveCollisions(boxes: ICommentBox[], chartArea: any): void {
    boxes.sort((a, b) => a.y - b.y);
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            const overlapsX = b.x < a.x + a.w && b.x + b.w > a.x;
            const overlapsY = b.y < a.y + a.h + 2;
            if (overlapsX && overlapsY) {
                b.y = a.y + a.h + 4;
                if (b.y + b.h > chartArea.bottom) b.y = a.y - b.h - 4;
            }
        }
    }
}

function renderBoxes(ctx: CanvasRenderingContext2D, boxes: ICommentBox[]): void {
    boxes.forEach(box => {
        ctx.fillStyle   = 'rgba(8,8,8,0.95)';
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, box.w, box.h, 4);
        ctx.fill();
        ctx.stroke();

        ctx.textBaseline = 'top';
        ctx.textAlign    = 'left';
        let textY = box.y + PAD_Y;

        if (box.stage) {
            ctx.fillStyle = '#888';
            ctx.font      = `${STAGE_FONT_SZ}px ${FONT_FAMILY}`;
            ctx.fillText(box.stage, box.x + PAD_X, textY);
            textY += LINE_H;
        }

        ctx.fillStyle = '#ccc';
        ctx.font      = `${FONT_SZ}px ${FONT_FAMILY}`;
        for (const line of box.cmtLines) {
            ctx.fillText(line, box.x + PAD_X, textY);
            textY += LINE_H;
        }
    });
}
