import type { IParsedRallyData, IStageInfo } from '../../shared/types';
import { driverColor } from "../colors";

export interface IChartDataset {
    label:               string;
    driverKey:           string;
    _displayName:        string;
    _car:                string;
    data:                (number | null)[];
    borderColor:         string;
    backgroundColor:     string;
    borderWidth:         number;
    pointStyle:          string[];
    pointRadius:         number[];
    pointBackgroundColor:string[];
    pointHoverRadius:    number;
    tension:             number;
    spanGaps:            boolean;
    hidden:              boolean;
    segment:             { borderDash: (ctx: any) => number[] | undefined };
    _cumPen:             number[];
    _cumSP:              number[];
    _cumSR:              number[];
    _hasSR:              boolean[];
    _cmts:               string[];
    _stageLabels:        string[];
}

const POINT_RADIUS_NORMAL  = 2;
const POINT_RADIUS_FINAL   = 3;
const POINT_RADIUS_COMMENT = 6;
const POINT_HOVER_RADIUS   = 7;
const BORDER_WIDTH         = 1.8;
const DASH_ON  = 6;
const DASH_OFF = 4;

export function buildDatasets(
    data:             IParsedRallyData,
    stages:           IStageInfo[],
    recordMap:        Map<string, Map<number, any>>,
    cumPenMap:        Map<string, Map<number, number>>,
    cumSPMap:         Map<string, Map<number, number>>,
    cumSRMap:         Map<string, Map<number, number>>,
    activeDriverKeys: Set<string>,
    activeGroups:     Set<string>,
    activeCars:       Set<string>,
): IChartDataset[] {
    return data.drivers.map((drv, gi) => {
        const color = driverColor(gi);
        const pts          = buildDriverPoints(drv, stages, recordMap, cumPenMap, cumSPMap, cumSRMap, color);
        const dnfCommentPtIdx = pts.dnfCommentPtIdx;
        const grpOk = !data.groups.length || activeGroups.has(drv.group);
        const carOk = !activeCars.size || activeCars.has(drv.car);
        const dn    = drv.realName && drv.realName !== drv.username
            ? `${drv.username} (${drv.realName})`
            : drv.username;

        return {
            label:               drv.label,
            driverKey:           drv.username,
            _displayName:        dn,
            _car:                drv.car,
            data:                pts.y,
            borderColor:         color,
            backgroundColor:     color + '22',
            borderWidth:         BORDER_WIDTH,
            pointStyle:          pts.pointStyles,
            pointRadius:         pts.pointRadii,
            pointBackgroundColor:pts.pointColors,
            pointHoverRadius:    POINT_HOVER_RADIUS,
            tension:             0,
            spanGaps:            false,
            hidden:              !activeDriverKeys.has(drv.username) || !grpOk || !carOk,
            segment: {
                borderDash: (ctx: any) =>
                    pts.hasSR[ctx.p1DataIndex] || ctx.p1DataIndex === dnfCommentPtIdx ? [DASH_ON, DASH_OFF] : undefined,
            },
            _cumPen:      pts.cumPen,
            _cumSP:       pts.cumSP,
            _cumSR:       pts.cumSR,
            _hasSR:       pts.hasSR,
            _cmts:        pts.cmts,
            _stageLabels: pts.stageLabels,
        };
    });
}

function buildDriverPoints(
    drv:       any,
    stages:    IStageInfo[],
    recordMap: Map<string, Map<number, any>>,
    cumPenMap: Map<string, Map<number, number>>,
    cumSPMap:  Map<string, Map<number, number>>,
    cumSRMap:  Map<string, Map<number, number>>,
    color:     string,
) {
    const y:           (number | null)[] = [0];
    const pointStyles: string[]          = ['circle'];
    const pointRadii:  number[]          = [0];
    const pointColors: string[]          = ['transparent'];
    const cumPen:      number[]          = [0];
    const cumSP:       number[]          = [0];
    const cumSR:       number[]          = [0];
    const hasSR:       boolean[]         = [false];
    const cmts:        string[]          = [''];
    const stageLabels: string[]          = ['Старт'];

    let cum                            = 0;
    let isDnf                          = false;
    let lastValidPtIdx                 = 0;
    let dnfCommentPtIdx: number | null = null;

    const lastDnfCmtStageNum: number | null = (() => {
        for (let i = stages.length - 1; i >= 0; i--) {
            const rec = recordMap.get(drv.username)?.get(stages[i].num);
            if (rec?.time1 === null && rec?.comment?.trim()) return stages[i].num;
        }
        return null;
    })();

    for (const st of stages) {
        const rec    = recordMap.get(drv.username)?.get(st.num) ?? null;
        const pen    = cumPenMap.get(drv.username)?.get(st.num) ?? 0;
        const sp     = cumSPMap.get(drv.username)?.get(st.num)  ?? 0;
        const srBase = cumSRMap.get(drv.username)?.get(st.num)  ?? 0;
        const srThis = rec?.superRally ? 1 : 0;
        const thisSR = srThis > 0;
        const hasCmt = !!rec?.comment?.trim();
        const slFull = `SS${st.num} ${st.name}`;

        if (st.num === lastDnfCmtStageNum && rec?.time1 === null && rec?.comment?.trim()) {
            const ptIdx     = y.length;
            dnfCommentPtIdx = ptIdx;
            y.push(cum, null, null);
            pointStyles.push('rectRot', 'circle', 'circle');
            pointRadii.push(POINT_RADIUS_COMMENT, 0, 0);
            pointColors.push('#fff', color, color);
            cumPen.push(pen, pen, pen);
            cumSP.push(sp, sp, sp);
            cumSR.push(srBase + srThis, srBase + srThis, srBase + srThis);
            hasSR.push(thisSR, thisSR, thisSR);
            cmts.push(rec.comment, '', '');
            stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
            isDnf = true;
            continue;
        }

        if (isDnf || !rec || rec.time1 === null) {
            y.push(null, null, null);
            pointStyles.push('circle', 'circle', 'circle');
            pointRadii.push(0, 0, 0);
            pointColors.push(color, color, color);
            cumPen.push(pen, pen, pen);
            cumSP.push(sp, sp, sp);
            cumSR.push(srBase + srThis, srBase + srThis, srBase + srThis);
            hasSR.push(thisSR, thisSR, thisSR);
            cmts.push('', '', rec?.comment ?? '');
            stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
            isDnf = true;
            continue;
        }

        const t1 = rec.time1 ?? 0;
        const t2 = rec.time2 ?? 0;
        const t3 = rec.time3 ?? 0;
        y.push(cum + t1, cum + t2, cum + t3);
        pointStyles.push('circle', 'circle', hasCmt ? 'rectRot' : 'circle');
        pointRadii.push(POINT_RADIUS_NORMAL, POINT_RADIUS_NORMAL, hasCmt ? POINT_RADIUS_COMMENT : POINT_RADIUS_FINAL);
        pointColors.push(color, color, hasCmt ? '#fff' : color);
        cumPen.push(pen, pen, pen);
        cumSP.push(sp, sp, sp);
        cumSR.push(srBase + srThis, srBase + srThis, srBase + srThis);
        hasSR.push(thisSR, thisSR, thisSR);
        cmts.push('', '', rec.comment ?? '');
        stageLabels.push(`${slFull} SP1`, `${slFull} SP2`, slFull);
        cum += t3;
        lastValidPtIdx = y.length - 1;
    }

    return {
        y, pointStyles, pointRadii, pointColors,
        cumPen, cumSP, cumSR, hasSR, cmts, stageLabels,
        dnfCommentPtIdx, lastValidPtIdx,
    };
}
