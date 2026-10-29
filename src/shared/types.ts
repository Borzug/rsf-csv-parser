/** Один результат (водитель × спецучасток) из CSV */
export interface ILapRecord {
    stageNum:       number;
    stageName:      string;
    username:       string;
    realName:       string;
    /** Код страны ISO alpha-2 («FI»), может быть пустым */
    country:        string;
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

/** Записи по участнику и номеру СУ: recordMap.get(username)?.get(stageNum) */
export type TRecordMap = Map<string, Map<number, ILapRecord>>;

/** Информация о спецучастке */
export interface IStageInfo {
    num:  number;
    name: string;
}

/** Агрегированные данные об участнике */
export interface IDriverInfo {
    username: string;
    realName: string;
    country:  string;
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
    /** Коды стран участников; '' — страна не указана. Пусто, если колонки нет. */
    countries: string[];
}
