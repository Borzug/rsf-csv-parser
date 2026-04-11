export interface ICommentEntry {
    stageNum:       number;
    stageName:      string;
    time3:          number | null;
    gapToLeader:    number | null;
    penalty:        number;
    servicePenalty: number;
    superRally:     boolean;
    comment:        string;
}

export interface IDriverComments {
    username:  string;
    realName:  string;
    car:       string;
    group:     string;
    totalTime: number;
    entries:   ICommentEntry[];
}
