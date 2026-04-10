import type { IParsedRallyData, ILapRecord } from '../../shared/types';

export interface IRallyLookups {
    recordMap: Map<string, Map<number, ILapRecord>>;
    cumPenMap: Map<string, Map<number, number>>;
    cumSPMap:  Map<string, Map<number, number>>;
    cumSRMap:  Map<string, Map<number, number>>;
}

export function buildRallyLookups(data: IParsedRallyData): IRallyLookups {
    const recordMap: Map<string, Map<number, ILapRecord>> = new Map();
    const cumPenMap: Map<string, Map<number, number>>     = new Map();
    const cumSPMap:  Map<string, Map<number, number>>     = new Map();
    const cumSRMap:  Map<string, Map<number, number>>     = new Map();

    for (const r of data.records) {
        if (!recordMap.has(r.username)) recordMap.set(r.username, new Map());
        recordMap.get(r.username)!.set(r.stageNum, r);
    }

    const sorted = [...data.stages].sort((a, b) => a.num - b.num);
    for (const drv of data.drivers) {
        const pm = new Map<number, number>();
        const sm = new Map<number, number>();
        const rm = new Map<number, number>();
        let cp = 0, cs = 0, cr = 0;
        for (const st of sorted) {
            pm.set(st.num, cp);
            sm.set(st.num, cs);
            rm.set(st.num, cr);
            const r = recordMap.get(drv.username)?.get(st.num);
            if (r) {
                cp += r.penalty ?? 0;
                cs += r.servicePenalty ?? 0;
                if (r.superRally) cr++;
            }
        }
        cumPenMap.set(drv.username, pm);
        cumSPMap.set(drv.username, sm);
        cumSRMap.set(drv.username, rm);
    }

    return { recordMap, cumPenMap, cumSPMap, cumSRMap };
}
