import type { IDriverInfo, IParsedRallyData, IStageInfo, TRecordMap } from '../../shared/types';
import { POINTS_PER_STAGE } from "./points";
import { driverColor } from "../colors";
import { passesAttrFilters } from "../filters/filterState";
import { driverDisplayName } from "../../shared/driverName";

export interface IChartDataset {
    label:               string;
    driverKey:           string;
    _displayName:        string;
    _car:                string;
    data:                (number | null)[];
    borderColor:         string;
    backgroundColor:     string;
    borderWidth:         number;
    pointRadius:         number;
    pointBackgroundColor:string;
    pointHoverRadius:    number;
    /** Точки рисует pluginPoints — см. пояснение там */
    _ptStyle:            string[];
    _ptRadius:           number[];
    _ptColor:            string[];
    _ptHoverRadius:      number;
    tension:             number;
    spanGaps:            boolean;
    hidden:              boolean;
    segment?:            { borderDash: (ctx: any) => number[] | undefined };
    _cumPen:             number[];
    _cumSP:              number[];
    _cumSR:              number[];
    _hasSR:              boolean[];
    _cmts:               string[];
    /** Точка и СУ комментария к сходу (комментарий может висеть на точке предыдущего СУ). */
    _dnfCmtPtIdx:        number | null;
    _dnfCmtStageIdx:     number | null;
}

const POINT_RADIUS_NORMAL  = 2;
const POINT_RADIUS_FINAL   = 3;
const POINT_RADIUS_COMMENT = 6;
const POINT_HOVER_RADIUS   = 7;
const BORDER_WIDTH         = 1.8;
const DASH_ON  = 6;
const DASH_OFF = 4;
/** Заливка ромба-комментария — белая, чтобы ромб читался поверх любой линии */
const COMMENT_POINT_FILL = "#fff";

export function buildDatasets(
    data:             IParsedRallyData,
    stages:           IStageInfo[],
    recordMap:        TRecordMap,
    cumPenMap:        Map<string, Map<number, number>>,
    cumSPMap:         Map<string, Map<number, number>>,
    cumSRMap:         Map<string, Map<number, number>>,
    activeDriverKeys: Set<string>,
    activeGroups:     Set<string>,
    activeCars:       Set<string>,
    activeCountries:  Set<string>,
): IChartDataset[] {
    return data.drivers.map((drv, gi) => {
        const color = driverColor(gi);
        const pts          = buildDriverPoints(drv, stages, recordMap, cumPenMap, cumSPMap, cumSRMap, color);
        const dnfCommentPtIdx = pts.dnfCommentPtIdx;
        const attrOk = passesAttrFilters(data, { activeGroups, activeCars, activeCountries }, drv);
        const dn   = driverDisplayName(drv);

        return {
            label:               drv.label,
            driverKey:           drv.username,
            _displayName:        dn,
            _car:                drv.car,
            data:                pts.y,
            borderColor:         color,
            backgroundColor:     color + '22',
            borderWidth:         BORDER_WIDTH,
            pointRadius:         0,
            pointBackgroundColor:color,
            pointHoverRadius:    0,
            _ptHoverRadius:      POINT_HOVER_RADIUS,
            _ptStyle:            pts.pointStyles,
            _ptRadius:           pts.pointRadii,
            _ptColor:            pts.pointColors,
            tension:             0,
            spanGaps:            false,
            hidden:              !activeDriverKeys.has(drv.username) || !attrOk,
            // Функция стиля отрезков вызывается на каждый отрезок при каждом update(),
            // поэтому подключаем её только линиям, где пунктир действительно есть
            segment: pts.hasSR.some(Boolean) || dnfCommentPtIdx !== null
                ? {
                    borderDash: (ctx: any) =>
                        pts.hasSR[ctx.p1DataIndex] || ctx.p1DataIndex === dnfCommentPtIdx ? [DASH_ON, DASH_OFF] : undefined,
                }
                : undefined,
            _cumPen:      pts.cumPen,
            _cumSP:       pts.cumSP,
            _cumSR:       pts.cumSR,
            _hasSR:       pts.hasSR,
            _cmts:        pts.cmts,
            _dnfCmtPtIdx:    pts.dnfCommentPtIdx,
            _dnfCmtStageIdx: pts.dnfCmtStageIdx,
        };
    });
}

/** Точки линии участника и данные для подсказки — по POINTS_PER_STAGE на каждый СУ. */
function buildDriverPoints(
    drv:       IDriverInfo,
    stages:    IStageInfo[],
    recordMap: TRecordMap,
    cumPenMap: Map<string, Map<number, number>>,
    cumSPMap:  Map<string, Map<number, number>>,
    cumSRMap:  Map<string, Map<number, number>>,
    color:     string,
) {
    // Точка 0 — старт
    const y:           (number | null)[] = [0];
    const pointStyles: string[]          = ['circle'];
    const pointRadii:  number[]          = [0];
    const pointColors: string[]          = ['transparent'];
    const cumPen:      number[]          = [0];
    const cumSP:       number[]          = [0];
    const cumSR:       number[]          = [0];
    const hasSR:       boolean[]         = [false];
    const cmts:        string[]          = [''];

    let cum            = 0;
    let isDnf          = false;
    let lastValidPtIdx = 0;
    let dnfCommentPtIdx: number | null = null;
    // СУ, где сошёл участник: комментарий висит на последней пройденной точке,
    // а она может относиться к предыдущему СУ
    let dnfCmtStageIdx:  number | null = null;

    for (let si = 0; si < stages.length; si++) {
        const st     = stages[si];
        const rec    = recordMap.get(drv.username)?.get(st.num) ?? null;
        const pen    = cumPenMap.get(drv.username)?.get(st.num) ?? 0;
        const sp     = cumSPMap.get(drv.username)?.get(st.num)  ?? 0;
        const sr     = (cumSRMap.get(drv.username)?.get(st.num) ?? 0) + (rec?.superRally ? 1 : 0);
        const thisSR = !!rec?.superRally;
        const comment = rec?.comment?.trim() ? rec.comment : '';

        // Сколько сплитов СУ пройдено подряд: 0 — не стартовал (или уже сошёл), 3 — финишировал
        const splits = [rec?.time1 ?? null, rec?.time2 ?? null, rec?.time3 ?? null];
        let reached = 0;
        if (!isDnf) while (reached < POINTS_PER_STAGE && splits[reached] !== null) reached++;
        const finished = reached === POINTS_PER_STAGE;

        for (let k = 0; k < POINTS_PER_STAGE; k++) {
            const passed   = k < reached;
            const isFinish = k === POINTS_PER_STAGE - 1;
            // Комментарий к пройденному СУ — ромб на финише; к сходу — см. markDnfComment
            const cmtHere  = finished && isFinish && !!comment;
            y.push(passed ? cum + splits[k]! : null);
            pointStyles.push(cmtHere ? 'rectRot' : 'circle');
            pointRadii.push(!passed ? 0 : cmtHere ? POINT_RADIUS_COMMENT : isFinish ? POINT_RADIUS_FINAL : POINT_RADIUS_NORMAL);
            pointColors.push(cmtHere ? COMMENT_POINT_FILL : color);
            cmts.push(cmtHere ? comment : '');
            cumPen.push(pen); cumSP.push(sp); cumSR.push(sr); hasSR.push(thisSR);
        }

        if (finished) {
            cum += splits[POINTS_PER_STAGE - 1]!;
            lastValidPtIdx = y.length - 1;
        } else if (!isDnf) {
            if (reached > 0) lastValidPtIdx = y.length - POINTS_PER_STAGE + reached - 1;
            // Комментарий к сходу вешаем на последнюю пройденную точку (не на старт)
            if (comment && lastValidPtIdx > 0) {
                pointStyles[lastValidPtIdx] = 'rectRot';
                pointRadii[lastValidPtIdx]  = POINT_RADIUS_COMMENT;
                pointColors[lastValidPtIdx] = COMMENT_POINT_FILL;
                cmts[lastValidPtIdx]        = comment;
                dnfCommentPtIdx = lastValidPtIdx;
                dnfCmtStageIdx  = si;
            }
            isDnf = true;
        }
    }

    return {
        y, pointStyles, pointRadii, pointColors,
        cumPen, cumSP, cumSR, hasSR, cmts,
        dnfCommentPtIdx, dnfCmtStageIdx,
    };
}
