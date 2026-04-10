import type { IStageInfo } from '../../shared/types';

const FONT_FAMILY     = "'Fira Code', monospace";
const FONT_SIZE_SS    = 11;
const FONT_SIZE_NM    = 10;
const HOVER_BG_EVEN   = '#262626';
const HOVER_BG_ODD    = '#222222';
const HOVER_BORDER    = '#c0392b';

export function buildStageNamesPlugin(
    stages:         IStageInfo[],
    rot45:          boolean,
    rot90:          boolean,
    getHoveredIdx:  () => number | null,
): object {
    return {
        id: 'stageNames',
        afterDraw(ch: any): void {
            if (!stages.length) return;
            const { ctx, chartArea, scales } = ch;
            const xs         = scales.x;
            const bot        = chartArea.bottom;
            const hoveredIdx = getHoveredIdx();
            ctx.save();

            for (let i = 0; i < stages.length; i++) {
                drawStageBand(ctx, stages[i], i, xs, bot, rot45, rot90, hoveredIdx === i);
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

    const bandH = rot90 ? 108 : rot45 ? 88 : 40;

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

    if (!rot45 && !rot90) {
        drawHorizontalLabel(ctx, stage, xL, xR, bot, hovered);
    } else if (rot45) {
        drawRotatedLabel(ctx, stage, xL, bot, Math.PI / 4, hovered);
    } else {
        drawRotatedLabel(ctx, stage, xL, bot, Math.PI / 2, hovered);
    }
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
    ctx.fillStyle    = hovered ? '#e74c3c' : '#c0392b';
    ctx.font         = `bold ${FONT_SIZE_SS}px ${FONT_FAMILY}`;
    ctx.fillText(`SS${stage.num}`, xMid, bot + 6);

    const maxChars = Math.max(4, Math.floor((xR - xL - 4) / 7));
    const name     = stage.name.length > maxChars
        ? stage.name.slice(0, maxChars - 1) + '…'
        : stage.name;
    ctx.fillStyle = hovered ? '#888' : '#666';
    ctx.font      = `${FONT_SIZE_NM}px ${FONT_FAMILY}`;
    ctx.fillText(name, xMid, bot + 21);
}

function drawRotatedLabel(
    ctx:     CanvasRenderingContext2D,
    stage:   IStageInfo,
    xL:      number,
    bot:     number,
    angle:   number,
    hovered: boolean,
): void {
    const MAX_CHARS = angle === Math.PI / 4 ? 22 : 28;
    ctx.save();
    ctx.translate(xL + 2, bot + 4);
    ctx.rotate(angle);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = hovered ? '#e74c3c' : '#c0392b';
    ctx.font      = `bold ${FONT_SIZE_NM}px ${FONT_FAMILY}`;
    const ssLabel = `SS${stage.num} `;
    ctx.fillText(ssLabel, 0, 0);

    const ssW  = ctx.measureText(ssLabel).width;
    const name = stage.name.length > MAX_CHARS
        ? stage.name.slice(0, MAX_CHARS - 1) + '…'
        : stage.name;
    ctx.fillStyle = hovered ? '#888' : '#666';
    ctx.font      = `${FONT_SIZE_NM}px ${FONT_FAMILY}`;
    ctx.fillText(name, ssW, 0);
    ctx.restore();
}
