export interface IDriverStageSnap {
    time3:          number | null;
    hasSR:          boolean;
    penalty:        number;
    servicePenalty: number;
}

export interface IDriverStats {
    username:     string;
    realName:     string;
    car:          string;
    group:        string;
    displayName:  string;
    totalTime:    number | null;
    totalPenalty: number;
    srCount:      number;
    snaps:        IDriverStageSnap[];
}

export interface IDriverResult {
    stats:              IDriverStats;
    position:           number;
    totalGap:           number | null;
    avgGapFromLeader:   number | null;
    avgGapFromPrev:     number | null;
    cleanGapFromLeader: number | null;
    cleanGapFromPrev:   number | null;
    cleanCountLeader:   number;
    cleanCountPrev:     number;
    totalStageCount:    number;
}
