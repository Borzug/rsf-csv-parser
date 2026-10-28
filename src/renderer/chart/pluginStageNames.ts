import type { IStageInfo } from '../../shared/types';

const FONT_FAMILY     = "'Fira Code', monospace";
const FONT_SIZE_SS    = 11;
const FONT_SIZE_NM    = 10;
const HOVER_BG_EVEN   = '#262626';
const HOVER_BG_ODD    = '#222222';
const HOVER_BORDER    = '#c0392b';

/** С какого числа СУ подписи под осью поворачиваются на 45° и на 90°. */
export const ROTATE_45_AT = 9;
export const ROTATE_90_AT = 20;

/** Строка счётчиков 💬 сразу под осью, над подписями СУ. */
export const COMMENT_ROW_H = 16;

export function buildStageNamesPlugin(
    getStages:         () => IStageInfo[],
    getHoveredIdx:     () => number | null,
    getCommentCounts:  (ch: any) => number[],
    getHoveredCounter: () => number | null,
): object {
    return {
        id: 'stageNames',
        afterDraw(ch: any): void {
            const stages = getStages();
            if (!stages.length) return;
            const rot45  = stages.length > ROTATE_45_AT && stages.length <= ROTATE_90_AT;
            const rot90  = stages.length > ROTATE_90_AT;
            const { ctx, chartArea, scales } = ch;
            const xs         = scales.x;
            const bot        = chartArea.bottom;
            const hoveredIdx = getHoveredIdx();
            const counts     = getCommentCounts(ch);
            const hoveredCnt = getHoveredCounter();
            ctx.save();

            for (let i = 0; i < stages.length; i++) {
                drawStageBand(ctx, stages[i], i, xs, bot, rot45, rot90, hoveredIdx === i);
                drawCommentCounter(ctx, counts[i] ?? 0, i, xs, bot, hoveredCnt === i);
            }
            ctx.restore();
        },
    };
}

function drawStageBand(
    ctx:     CanvasRenderingContext2D,
    stage:   IStageInfo,
    i:       number,
    xs:      any,
    bot:     number,
    rot45:   boolean,
    rot90:   boolean,
    hovered: boolean,
): void {
    const xL = xs.getPixelForTick(i * 3);
    const xR = xs.getPixelForTick(i * 3 + 3);
    if (xL >= xR) return;

    const bandH = (rot90 ? 108 : rot45 ? 88 : 40) + COMMENT_ROW_H;

    if (hovered) {
        ctx.fillStyle = i % 2 === 0 ? HOVER_BG_EVEN : HOVER_BG_ODD;
    } else {
        ctx.fillStyle = i % 2 === 0 ? '#1c1c1c' : '#181818';
    }
    ctx.fillRect(xL, bot + 2, xR - xL, bandH);

    if (hovered) {
        ctx.strokeStyle = HOVER_BORDER;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(xL, bot + 2);
        ctx.lineTo(xR, bot + 2);
        ctx.stroke();
    }

    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(xL, bot + 2);
    ctx.lineTo(xL, bot + 2 + bandH);
    ctx.stroke();

    const labelTop = bot + COMMENT_ROW_H;
    if (!rot45 && !rot90) {
        drawHorizontalLabel(ctx, stage, xL, xR, labelTop, hovered);
    } else if (rot45) {
        drawRotatedLabel(ctx, stage, xL, xR, labelTop, Math.PI / 4, hovered);
    } else {
        drawRotatedLabel(ctx, stage, xL, xR, labelTop, Math.PI / 2, hovered);
    }
}

/** Число комментариев на СУ; «💬 N», если полоса достаточно широкая, иначе только N. */
function drawCommentCounter(
    ctx:     CanvasRenderingContext2D,
    count:   number,
    i:       number,
    xs:      any,
    bot:     number,
    hovered: boolean,
): void {
    if (!count) return;
    const xL = xs.getPixelForTick(i * 3);
    const xR = xs.getPixelForTick(i * 3 + 3);
    if (xL >= xR) return;

    ctx.font = `${FONT_SIZE_NM}px ${FONT_FAMILY}`;
    const num   = String(count);
    const full  = `💬 ${num}`;
    const text  = ctx.measureText(full).width + 8 <= xR - xL ? full : num;
    const w     = Math.min(ctx.measureText(text).width + 8, xR - xL - 2);
    const xMid  = (xL + xR) / 2;
    const yMid  = bot + 2 + COMMENT_ROW_H / 2;

    ctx.fillStyle = hovered ? 'rgba(241,196,15,0.25)' : 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(xMid - w / 2, yMid - 6.5, w, 13, 6);
    ctx.fill();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = hovered ? '#fff' : '#c8c8c8';
    ctx.fillText(text, xMid, yMid + 0.5);
}

function drawHorizontalLabel(
    ctx:     CanvasRenderingContext2D,
    stage:   IStageInfo,
    xL:      number,
    xR:      number,
    bot:     number,
    hovered: boolean,
): void {
    const xMid = (xL + xR) / 2;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = hovered ? '#ff7a6b' : '#ef5b4c';
    ctx.font         = `bold ${FONT_SIZE_SS}px ${FONT_FAMILY}`;
    ctx.fillText(`SS${stage.num}`, xMid, bot + 6);

    const maxChars = Math.max(4, Math.floor((xR - xL - 4) / 7));
    const name     = stage.name.length > maxChars
        ? stage.name.slice(0, maxChars - 1) + '…'
        : stage.name;
    ctx.fillStyle = hovered ? '#c8c8c8' : '#8a8a8a';
    ctx.font      = `${FONT_SIZE_NM}px ${FONT_FAMILY}`;
    ctx.fillText(name, xMid, bot + 21);
}

function drawRotatedLabel(
    ctx:     CanvasRenderingContext2D,
    stage:   IStageInfo,
    xL:      number,
    xR:      number,
    bot:     number,
    angle:   number,
    hovered: boolean,
): void {
    const MAX_CHARS  = angle === Math.PI / 4 ? 22 : 28;
    const PAD        = 4;

    // rot90: центрируем по горизонтали полосы — translateX сдвигается на half fontSize
    // rot45: начало текста в левом верхнем углу полосы с отступом PAD
    const translateX = angle === Math.PI / 2
        ? (xL + xR) / 2 + FONT_SIZE_NM / 2
        : xL + PAD;

    ctx.save();
    ctx.translate(translateX, bot + PAD);
    ctx.rotate(angle);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = hovered ? '#ff7a6b' : '#ef5b4c';
    ctx.font      = `bold ${FONT_SIZE_NM}px ${FONT_FAMILY}`;
    const ssLabel = `SS${stage.num} `;
    ctx.fillText(ssLabel, 0, 0);

    const ssW  = ctx.measureText(ssLabel).width;
    const name = stage.name.length > MAX_CHARS
        ? stage.name.slice(0, MAX_CHARS - 1) + '…'
        : stage.name;
    ctx.fillStyle = hovered ? '#c8c8c8' : '#8a8a8a';
    ctx.font      = `${FONT_SIZE_NM}px ${FONT_FAMILY}`;
    ctx.fillText(name, ssW, 0);
    ctx.restore();
}
