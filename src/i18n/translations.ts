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
    headerStats:            (finished, total, stages) => `финишировали ${finished} из ${total} · СУ: ${stages}`,

    tabChart:               '📈 График',
    tabResults:             '🏆 Результаты',
    tabComments:            '💬 Комментарии',

    chartLegendSuccess:     'Успешный проезд',
    chartLegendSuperRally:  'Super Rally',
    chartLegendComment:     'Комментарий',

    axisTimeTitle:          'Время',
    axisTimeUnits:          { h: 'ч', m: 'м', s: 'с' },

    yModeAbs:               'Время',
    yModeLeader:            'От лидера',
    yModePinned:            'От выбранного',
    yModePinnedDisabled:    'Выберите участника на графике или в легенде',
    tooltipGapLeader:       'К лидеру',
    tooltipGapPinned:       'К выбранному',

    dropHint:               'или перетащите файл в окно',
    dropOverlay:            'Отпустите CSV-файл',
    welcomeHelp:            'Таблица результатов онлайн-ралли, экспортированная с rallysimfans.hu (например, 105003_table.csv).',
    resumeButton:           (name) => `← Вернуться к анализу: ${name}`,
    rallyTitle:             (id) => `Ралли #${id}`,
    rallyLinkTitle:         'Открыть ралли на rallysimfans.hu',

    pinnedHint:             'Ctrl/Shift + клик — добавить к сравнению',
    pinnedChipRemove:       'Убрать из сравнения',

    presetTop:              (n) => `Топ-${n}`,
    presetTopTitle:         (n) => `Оставить первые ${n} мест среди видимых участников`,
    presetFinished:         'Финиш',
    presetFinishedTitle:    'Оставить только финишировавших',

    selectedCount:          (n) => `Выбрано участников: ${n}`,

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
    colAvgGapLeader:        'Темп/СУ: лидер',
    colAvgGapPrev:          'Темп/СУ: пред.',
    colCleanGapLeader:      'Чист. темп: лидер',
    colCleanGapPrev:        'Чист. темп: пред.',
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
    headerStats:            (finished, total, stages) => `${finished} of ${total} finished · ${stages} stage${stages !== 1 ? 's' : ''}`,

    tabChart:               '📈 Chart',
    tabResults:             '🏆 Results',
    tabComments:            '💬 Comments',

    chartLegendSuccess:     'Completed stage',
    chartLegendSuperRally:  'Super Rally',
    chartLegendComment:     'Comment',

    axisTimeTitle:          'Time',
    axisTimeUnits:          { h: 'h', m: 'm', s: 's' },

    yModeAbs:               'Time',
    yModeLeader:            'Gap to leader',
    yModePinned:            'Gap to selected',
    yModePinnedDisabled:    'Select a driver on the chart or in the legend',
    tooltipGapLeader:       'To leader',
    tooltipGapPinned:       'To selected',

    dropHint:               'or drop the file into the window',
    dropOverlay:            'Drop the CSV file',
    welcomeHelp:            'Online rally results table exported from rallysimfans.hu (e.g. 105003_table.csv).',
    resumeButton:           (name) => `← Back to analysis: ${name}`,
    rallyTitle:             (id) => `Rally #${id}`,
    rallyLinkTitle:         'Open the rally on rallysimfans.hu',

    pinnedHint:             'Ctrl/Shift + click to add to comparison',
    pinnedChipRemove:       'Remove from comparison',

    presetTop:              (n) => `Top ${n}`,
    presetTopTitle:         (n) => `Keep the top ${n} of the visible drivers`,
    presetFinished:         'Finished',
    presetFinishedTitle:    'Keep only drivers who finished',

    selectedCount:          (n) => `Selected: ${n}`,

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
    colAvgGapLeader:        'Pace/SS: leader',
    colAvgGapPrev:          'Pace/SS: prev',
    colCleanGapLeader:      'Clean pace: leader',
    colCleanGapPrev:        'Clean pace: prev',
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
    headerStats:            (finished, total, stages) => `${total} indulóból ${finished} célba ért · ${stages} szakasz`,

    tabChart:               '📈 Grafikon',
    tabResults:             '🏆 Eredmények',
    tabComments:            '💬 Megjegyzések',

    chartLegendSuccess:     'Teljesített szakasz',
    chartLegendSuperRally:  'Super Rally',
    chartLegendComment:     'Megjegyzés',

    axisTimeTitle:          'Idő',
    axisTimeUnits:          { h: 'ó', m: 'p', s: 'mp' },

    yModeAbs:               'Idő',
    yModeLeader:            'Hátrány a vezetőtől',
    yModePinned:            'Hátrány a kijelölttől',
    yModePinnedDisabled:    'Válassz versenyzőt a grafikonon vagy a jelmagyarázatban',
    tooltipGapLeader:       'Vezetőhöz',
    tooltipGapPinned:       'Kijelölthöz',

    dropHint:               'vagy húzd a fájlt az ablakba',
    dropOverlay:            'Engedd el a CSV fájlt',
    welcomeHelp:            'A rallysimfans.hu oldalról exportált online rally eredménytábla (pl. 105003_table.csv).',
    resumeButton:           (name) => `← Vissza az elemzéshez: ${name}`,
    rallyTitle:             (id) => `Rally #${id}`,
    rallyLinkTitle:         'Rally megnyitása a rallysimfans.hu oldalon',

    pinnedHint:             'Ctrl/Shift + kattintás — hozzáadás az összehasonlításhoz',
    pinnedChipRemove:       'Eltávolítás az összehasonlításból',

    presetTop:              (n) => `Top ${n}`,
    presetTopTitle:         (n) => `Csak a látható versenyzők első ${n} helyezettje`,
    presetFinished:         'Célba értek',
    presetFinishedTitle:    'Csak a célba ért versenyzők',

    selectedCount:          (n) => `Kijelölve: ${n}`,

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
