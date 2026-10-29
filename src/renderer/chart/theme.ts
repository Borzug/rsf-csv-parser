/**
 * Цвета и шрифт графика. Canvas не видит CSS-переменных, поэтому общие токены берём
 * из style.css (:root) один раз, а цвета, которые есть только на холсте, — здесь.
 */
export interface IChartTheme {
    font:          string;
    /** Подписи осей и названия СУ */
    axisText:      string;
    axisTextHover: string;
    /** Номер СУ под осью */
    stageNum:      string;
    stageNumHover: string;
    /** Линия выделения полосы СУ под осью */
    accent:        string;
    /** Подсветка (активный комментарий) */
    highlight:     string;
    /** Сетка: граница СУ, промежуточный сплит, рамка осей и ноль в режимах отставания */
    gridStage:     string;
    gridSplit:     string;
    gridY:         string;
    axisBorder:    string;
    /** Чередующиеся полосы СУ под осью и их цвет при наведении */
    bandEven:      string;
    bandOdd:       string;
    bandEvenHover: string;
    bandOddHover:  string;
    /** Счётчик 💬 под осью */
    counterBg:      string;
    counterBgHover: string;
    counterText:    string;
    counterTextHover: string;
    /** Плашка с номером СУ над ромбом комментария */
    pillBg:        string;
    pillText:      string;
}

/** Базовый размер шрифта подписей осей. */
export const AXIS_FONT_SIZE = 11;

let cached: IChartTheme | null = null;

export function chartTheme(): IChartTheme {
    if (cached) return cached;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    cached = {
        font:             token('--ff', 'monospace'),
        axisText:         '#8a8a8a',
        axisTextHover:    '#c8c8c8',
        stageNum:         token('--red-text', '#ef5b4c'),
        stageNumHover:    '#ff7a6b',
        accent:           token('--red', '#c0392b'),
        highlight:        token('--gold', '#f1c40f'),
        gridStage:        '#2a2a2a',
        gridSplit:        '#1a1a1a',
        gridY:            '#1c1c1c',
        axisBorder:       '#3a3a3a',
        bandEven:         '#1c1c1c',
        bandOdd:          '#181818',
        bandEvenHover:    '#262626',
        bandOddHover:     '#222222',
        counterBg:        'rgba(255,255,255,0.08)',
        counterBgHover:   'rgba(241,196,15,0.25)',
        counterText:      '#c8c8c8',
        counterTextHover: '#fff',
        pillBg:           'rgba(10,10,10,0.88)',
        pillText:         '#eee',
    };
    return cached;
}
