export type Language = 'ru' | 'en' | 'hu';

/** Подписи и подсказки колонок темпа */
export interface IPaceTexts {
    colAvgGapLeader:        string;
    colAvgGapPrev:          string;
    colCleanGapLeader:      string;
    colCleanGapPrev:        string;
    colAvgGapLeaderTitle:   string;
    colAvgGapPrevTitle:     string;
    colCleanGapLeaderTitle: string;
    colCleanGapPrevTitle:   string;
}

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

    // Ось Y графика
    axisTimeTitle:          string;
    axisPositionTitle:      string;
    axisTimeUnits:          { h: string; m: string; s: string };

    // Режим оси Y
    yModeAbs:               string;
    yModeLeader:            string;
    yModePinned:            string;
    yModePosition:          string;
    yModePositionTitle:     string;
    yModePinnedDisabled:    string;
    tooltipGapLeader:       string;
    tooltipPosition:        string;
    tooltipGapPinned:       string;

    // Стартовый экран — файл и возврат к анализу
    dropHint:               string;
    dropOverlay:            string;
    welcomeHelp:            string;
    resumeButton:           (fileName: string) => string;
    rallyTitle:             (rallyId: string) => string;
    rallyLinkTitle:         string;

    // Сравнение закреплённых
    pinnedHint:             string;
    pinnedHintTouch:        string;
    legendSearchPlaceholder: string;
    legendSearchHint:       string;
    legendSearchNone:       string;

    // Доступность и мобильная вёрстка
    chartAriaLabel:         string;
    closeLabel:             string;
    pinnedChipRemove:       string;

    // Быстрый выбор участников
    presetTop:              (n: number) => string;
    presetTopTitle:         (n: number) => string;
    presetFinished:         string;
    presetFinishedTitle:    string;

    // Таблица результатов — выбор строк
    selectedCount:          (n: number) => string;
    cmtStripTitle:          (n: number) => string;
    cmtStripEntryTitle:     string;
    stageCmtScopePinned:    string;
    stageCmtScopeAll:       string;

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
    /** Подписи колонок темпа, когда известны длины СУ и темп считается на км */
    paceKm:                 IPaceTexts;
    unitKm:                 string;

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
