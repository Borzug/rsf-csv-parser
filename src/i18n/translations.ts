import { ITranslations } from "./types.js";

export const ru: ITranslations = {
    welcomeTitle:           'Загрузка данных ралли',
    welcomeDesc:            'Выберите CSV-файл с результатами гонки.',
    eventNameLabel:         'Название события',
    eventNameOptional:      '(необязательно)',
    selectFileButton:       '📂 Выбрать CSV-файл',

    fileReading:            'Чтение файла…',
    fileLoaded:             (stages, drivers) => `✓ Загружено: ${stages} участков, ${drivers} участников`,
    fileError:              '✗ Ошибка',
    fileReadError:          'Не удалось прочитать файл',

    defaultTitle:           'Rally Race Chart',
    filtersLabel:           'Фильтры',
    backButton:             '← Назад',
    headerStats:            (finished, total, stages) => `| 👤 ${finished}/${total}  |  SS ${stages}`,

    tabChart:               '📈 График',
    tabResults:             '🏆 Результаты',
    tabComments:            '💬 Комментарии',

    chartLegendSuccess:     'Успешный проезд',
    chartLegendSuperRally:  'Super Rally',
    chartLegendComment:     'Комментарий',

    pinnedCloseTitle:       'Снять выделение (Esc)',
    legendExpandTitle:      'Развернуть',

    filterChartStages:      'Спецучастки',
    filterParticipants:     'Участники',
    filterGroupClass:       'Группа / Класс',
    filterCar:              'Автомобиль',

    filterResultsStages:    'Этапы',
    filterResultsClass:     'Класс',

    filterAll:              'Все',
    filterNone:             'Ничего',
    filterSearch:           'Поиск…',

    colPosition:            '#',
    colParticipant:         'Участник',
    colClass:               'Класс',
    colCar:                 'Автомобиль',
    colTotalTime:           'Общее время',
    colPenalties:           'Штрафы',
    colAvgGapLeader:        'Темп за участок к лидеру',
    colAvgGapPrev:          'Темп за участок к пред.',
    colCleanGapLeader:      'Чист. темп за участок к лидеру',
    colCleanGapPrev:        'Чист. темп за участок к пред.',
    colTotalGap:            'Общее отставание',
    colSuperRally:          'SR',

    colAvgGapLeaderTitle:   'Отставание по темпу от лидера за участок с учётом SR',
    colAvgGapPrevTitle:     'Отставание по темпу от предыдущего места за участок с учётом SR',
    colCleanGapLeaderTitle: 'Чистое отставание по темпу от лидера за участок\nУчитываются только участки без SR для обоих участников',
    colCleanGapPrevTitle:   'Чистое отставание по темпу от предыдущего за участок\nУчитываются только участки без SR для обоих участников',
    cleanGapCellTooltip:    (used, total) =>
        `Отставание по темпу за участок\nРассчитано на основании прохождения ${used}/${total} этапов\n`
        + 'Учитываются только участки без SR для обоих участников',

    applyFilterButton:      'Применить фильтр по участникам',

    tooltipPenalty:         'Штраф',
    tooltipServicePenalty:  'Service Penalty',
    tooltipSuperRally:      'Super Rally',

    commentsEmpty:          'Нет комментариев в этой гонке',
    commentsSearchLabel:    'Поиск участника',
    commentsSearchPlaceholder: 'Имя или никнейм…',
    commentsLeader:         '🥇 лидер',
    commentsGap:            (time) => `Отставание: +${time}`,
    commentsPenalty:        (time) => `+${time} штраф`,
    commentsServicePenalty: (time) => `+${time} сервис`,
    commentsCount:          (n) => {
        if (n % 10 === 1 && n % 100 !== 11) return `${n} комментарий`;
        if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} комментария`;
        return `${n} комментариев`;
    },
};

export const en: ITranslations = {
    welcomeTitle:           'Load Rally Data',
    welcomeDesc:            'Select a CSV file with race results.',
    eventNameLabel:         'Event Name',
    eventNameOptional:      '(optional)',
    selectFileButton:       '📂 Select CSV File',

    fileReading:            'Reading file…',
    fileLoaded:             (stages, drivers) => `✓ Loaded: ${stages} stages, ${drivers} participants`,
    fileError:              '✗ Error',
    fileReadError:          'Failed to read file',

    defaultTitle:           'Rally Race Chart',
    filtersLabel:           'Filters',
    backButton:             '← Back',
    headerStats:            (finished, total, stages) => `| 👤 ${finished}/${total}  |  SS ${stages}`,

    tabChart:               '📈 Chart',
    tabResults:             '🏆 Results',
    tabComments:            '💬 Comments',

    chartLegendSuccess:     'Completed stage',
    chartLegendSuperRally:  'Super Rally',
    chartLegendComment:     'Comment',

    pinnedCloseTitle:       'Unpin (Esc)',
    legendExpandTitle:      'Expand',

    filterChartStages:      'Stages',
    filterParticipants:     'Participants',
    filterGroupClass:       'Group / Class',
    filterCar:              'Car',

    filterResultsStages:    'Stages',
    filterResultsClass:     'Class',

    filterAll:              'All',
    filterNone:             'None',
    filterSearch:           'Search…',

    colPosition:            '#',
    colParticipant:         'Participant',
    colClass:               'Class',
    colCar:                 'Car',
    colTotalTime:           'Total Time',
    colPenalties:           'Penalties',
    colAvgGapLeader:        'Pace Diff. per stage Leader',
    colAvgGapPrev:          'Pace Diff. per stage Prev',
    colCleanGapLeader:      'Clean Pace Diff. per stage Leader',
    colCleanGapPrev:        'Clean Pace Diff per stage Prev',
    colTotalGap:            'Total Gap',
    colSuperRally:          'SR',

    colAvgGapLeaderTitle:   'Pace difference to leader per stage (SR included)',
    colAvgGapPrevTitle:     'Pace difference to previous position per stage (SR included)',
    colCleanGapLeaderTitle: 'Clean pace difference to leader\nOnly stages without SR for both drivers',
    colCleanGapPrevTitle:   'Clean pace difference to previous\nOnly stages without SR for both drivers',
    cleanGapCellTooltip:    (used, total) =>
        `Pace difference per stage\nCalculated from ${used}/${total} stages\n`
        + 'Only stages without SR for both drivers',

    applyFilterButton:      'Apply Participant Filter',

    tooltipPenalty:         'Penalty',
    tooltipServicePenalty:  'Service Penalty',
    tooltipSuperRally:      'Super Rally',

    commentsEmpty:          'No comments in this race',
    commentsSearchLabel:    'Search participant',
    commentsSearchPlaceholder: 'Name or username…',
    commentsLeader:         '🥇 leader',
    commentsGap:            (time) => `Gap: +${time}`,
    commentsPenalty:        (time) => `+${time} penalty`,
    commentsServicePenalty: (time) => `+${time} service`,
    commentsCount:          (n) => `${n} comment${n !== 1 ? 's' : ''}`,
};

export const hu: ITranslations = {
    welcomeTitle:           'Rally adatok betöltése',
    welcomeDesc:            'Válassz egy CSV fájlt a versenyeredményekkel.',
    eventNameLabel:         'Esemény neve',
    eventNameOptional:      '(opcionális)',
    selectFileButton:       '📂 CSV fájl kiválasztása',

    fileReading:            'Fájl olvasása…',
    fileLoaded:             (stages, drivers) => `✓ Betöltve: ${stages} szakasz, ${drivers} résztvevő`,
    fileError:              '✗ Hiba',
    fileReadError:          'A fájl olvasása sikertelen',

    defaultTitle:           'Rally Race Chart',
    filtersLabel:           'Szűrők',
    backButton:             '← Vissza',
    headerStats:            (finished, total, stages) => `| 👤 ${finished}/${total}  |  SS ${stages}`,

    tabChart:               '📈 Grafikon',
    tabResults:             '🏆 Eredmények',
    tabComments:            '💬 Megjegyzések',

    chartLegendSuccess:     'Teljesített szakasz',
    chartLegendSuperRally:  'Super Rally',
    chartLegendComment:     'Megjegyzés',

    pinnedCloseTitle:       'Rögzítés feloldása (Esc)',
    legendExpandTitle:      'Kibontás',

    filterChartStages:      'Szakaszok',
    filterParticipants:     'Résztvevők',
    filterGroupClass:       'Csoport / Osztály',
    filterCar:              'Autó',

    filterResultsStages:    'Szakaszok',
    filterResultsClass:     'Osztály',

    filterAll:              'Mind',
    filterNone:             'Senki',
    filterSearch:           'Keresés…',

    colPosition:            '#',
    colParticipant:         'Résztvevő',
    colClass:               'Osztály',
    colCar:                 'Autó',
    colTotalTime:           'Összes idő',
    colPenalties:           'Büntetések',
    colAvgGapLeader:        'Átl. hátrány vez.',
    colAvgGapPrev:          'Átl. hátrány előző',
    colCleanGapLeader:      'Tiszta hátrány vez.',
    colCleanGapPrev:        'Tiszta hátrány előző',
    colTotalGap:            'Összes hátrány',
    colSuperRally:          'SR',

    colAvgGapLeaderTitle:   'Átlagos hátrány a vezértől szakaszonként (SR-rel)',
    colAvgGapPrevTitle:     'Átlagos hátrány az előző helyezettől szakaszonként (SR-rel)',
    colCleanGapLeaderTitle: 'Átlagos tiszta hátrány a vezértől\nCsak SR nélküli szakaszok mindkét versenyzőnél',
    colCleanGapPrevTitle:   'Átlagos tiszta hátrány az előzőtől\nCsak SR nélküli szakaszok mindkét versenyzőnél',
    cleanGapCellTooltip:    (used, total) =>
        `Számítva: ${used}/${total} szakasz alapján\n`
        + 'Csak SR nélküli szakaszok mindkét versenyzőnél',

    applyFilterButton:      'Résztvevő szűrő alkalmazása',

    tooltipPenalty:         'Büntetés',
    tooltipServicePenalty:  'Szerviz büntetés',
    tooltipSuperRally:      'Super Rally',

    commentsEmpty:          'Nincsenek megjegyzések ebben a versenyen',
    commentsSearchLabel:    'Résztvevő keresése',
    commentsSearchPlaceholder: 'Név vagy felhasználónév…',
    commentsLeader:         '🥇 vezető',
    commentsGap:            (time) => `Hátrány: +${time}`,
    commentsPenalty:        (time) => `+${time} büntetés`,
    commentsServicePenalty: (time) => `+${time} szerviz`,
    commentsCount:          (n) => `${n} megjegyzés`,
};
