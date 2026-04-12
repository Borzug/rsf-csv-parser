export type Language = 'ru' | 'en' | 'hu';

export interface ITranslations {
    // Welcome screen
    welcomeTitle:           string;
    welcomeDesc:            string;
    eventNameLabel:         string;
    eventNameOptional:      string;
    selectFileButton:       string;

    // Загрузка файла
    fileReading:            string;
    fileLoaded:             (stages: number, drivers: number) => string;
    fileError:              string;
    fileReadError:          string;

    // Навбар / шапка
    defaultTitle:           string;
    filtersLabel:           string;
    backButton:             string;
    headerStats:            (finished: number, total: number, stages: number) => string;

    // Вкладки
    tabChart:               string;
    tabResults:             string;
    tabComments:            string;

    // Легенда типа линии
    chartLegendSuccess:     string;
    chartLegendSuperRally:  string;
    chartLegendComment:     string;

    // Закреплённая строка
    pinnedCloseTitle:       string;
    legendExpandTitle:      string;

    // Фильтры — вкладка «График»
    filterChartStages:      string;
    filterParticipants:     string;
    filterGroupClass:       string;
    filterCar:              string;

    // Фильтры — вкладка «Результаты»
    filterResultsStages:    string;
    filterResultsClass:     string;

    // Фильтры — общие
    filterAll:              string;
    filterNone:             string;
    filterSearch:           string;

    // Таблица результатов — заголовки
    colPosition:            string;
    colParticipant:         string;
    colClass:               string;
    colCar:                 string;
    colTotalTime:           string;
    colPenalties:           string;
    colAvgGapLeader:        string;
    colAvgGapPrev:          string;
    colCleanGapLeader:      string;
    colCleanGapPrev:        string;
    colTotalGap:            string;
    colSuperRally:          string;

    // Таблица результатов — тултипы заголовков
    colAvgGapLeaderTitle:   string;
    colAvgGapPrevTitle:     string;
    colCleanGapLeaderTitle: string;
    colCleanGapPrevTitle:   string;
    cleanGapCellTooltip:    (used: number, total: number) => string;

    // Кнопка применить фильтр
    applyFilterButton:      string;

    // Тултип на графике
    tooltipPenalty:         string;
    tooltipServicePenalty:  string;
    tooltipSuperRally:      string;

    // Экран комментариев
    commentsEmpty:          string;
    commentsSearchLabel:    string;
    commentsSearchPlaceholder: string;
    commentsLeader:         string;
    commentsGap:            (time: string) => string;
    commentsPenalty:        (time: string) => string;
    commentsServicePenalty: (time: string) => string;
    commentsCount:          (n: number) => string;
}
