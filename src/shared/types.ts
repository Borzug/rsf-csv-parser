/** Один результат (водитель × спецучасток) из CSV */
export interface ILapRecord {
    stageNum:       number;
    stageName:      string;
    username:       string;
    realName:       string;
    car:            string;
    group:          string;
    time1:          number | null;
    time2:          number | null;
    time3:          number | null;
    penalty:        number;
    servicePenalty: number;
    superRally:     boolean;
    comment:        string;
}

/** Информация о спецучастке */
export interface IStageInfo {
    num:  number;
    name: string;
}

/** Агрегированные данные об участнике */
export interface IDriverInfo {
    username: string;
    realName: string;
    car:      string;
    group:    string;
    /** Метка фильтра: "username (Real Name) | Car" */
    label:    string;
}

/** Весь разобранный CSV */
export interface IParsedRallyData {
    records: ILapRecord[];
    stages:  IStageInfo[];
    drivers: IDriverInfo[];
    groups:  string[];
}
