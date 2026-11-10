import type { IParsedRallyData, IStageInfo, IDriverInfo, TRecordMap } from '../../shared/types.js';
import { i18n } from "../../i18n/index.js";
import {
    createElement,
    qsa
} from "../dom.js";
import {
    applyDriverSearch,
    buildSearchBox,
    reapplyDriverSearch
} from "./driverSearch.js";
import { buildCollapsibleFilterGroup, countBy, createFilterCount } from "./filterGroup.js";
import {
    IChartFilterCallbacks,
    IChartFilterState,
    filterId,
    passesFilters,
    refreshVisibleDriverKeys,
    setAllCheckboxes,
    syncVisibleCheckboxes
} from "./filterState.js";
import { countryName, prependFlag } from "../flags";
import { driverDisplayName } from "../../shared/driverName";
import { isCoarsePointer } from "../utils";

export function buildStageFilterUI(
    stages:    IStageInfo[],
    state:     IChartFilterState,
    callbacks: IChartFilterCallbacks,
    prefix:    string,
): void {
    const cont = document.getElementById(filterId(prefix, 'filter-stages'))!;
    cont.innerHTML = '';
    const { group, body, btnAll, btnNone } =
        buildCollapsibleFilterGroup(i18n.t().filterChartStages, filterId(prefix, 'counter-stages'));

    btnAll.addEventListener('click', () => {
        stages.forEach(s => state.activeStageNums.add(s.num));
        setAllCheckboxes(body, true);
        callbacks.onStagesChanged();
    });
    btnNone.addEventListener('click', () => {
        state.activeStageNums.clear();
        setAllCheckboxes(body, false);
        callbacks.onStagesChanged();
    });

    for (const s of stages) {
        const lbl = createElement('label', 'filter-item');
        lbl.dataset['stageNum'] = String(s.num);
        const cb = createElement('input') as HTMLInputElement;
        cb.type = 'checkbox'; cb.checked = state.activeStageNums.has(s.num);
        cb.addEventListener('change', () => {
            cb.checked
                ? state.activeStageNums.add(s.num)
                : state.activeStageNums.delete(s.num);
            callbacks.onStagesChanged();
        });
        lbl.appendChild(cb);
        lbl.appendChild(createElement('span', 'filter-ss', `SS${s.num}`));
        lbl.appendChild(createElement('span', 'filter-name', s.name));
        body.appendChild(lbl);
    }
    cont.appendChild(group);
}

/** Для каких данных построен список участников: текст поиска переживает перестройку (язык), но не смену файла. */
const driverListData = new WeakMap<HTMLElement, IParsedRallyData>();

export function buildDriverFilterUI(
    data:      IParsedRallyData,
    state:     IChartFilterState,
    callbacks: IChartFilterCallbacks,
    rankMap:   Map<string, number | null>,
    prefix:    string,
): void {
    const wrap = document.getElementById(filterId(prefix, 'filter-drivers-wrap'))!;
    const prevQuery = driverListData.get(wrap) === data
        ? wrap.querySelector<HTMLInputElement>('.filter-search')?.value ?? ''
        : '';
    driverListData.set(wrap, data);
    wrap.innerHTML = '';
    const { group, body, btnAll, btnNone } =
        buildCollapsibleFilterGroup(i18n.t().filterParticipants, filterId(prefix, 'counter-drivers'));
    const t = i18n.t();
    const drivers = data.drivers;

    // Сначала финишировавшие по месту, затем сошедшие по алфавиту
    const rankOf = (d: IDriverInfo) => rankMap.get(d.username) ?? null;
    const sorted = [...drivers].sort((a, b) => {
        const ra = rankOf(a), rb = rankOf(b);
        if (ra !== null && rb !== null) return ra - rb;
        if (ra !== null) return -1;
        if (rb !== null) return 1;
        return a.username.localeCompare(b.username);
    });

    btnAll.addEventListener('click', () => {
        drivers.filter(d => state.visibleDriverKeys.has(d.username))
            .forEach(d => state.activeDriverKeys.add(d.username));
        syncVisibleCheckboxes(body, true);
        callbacks.onDriversChanged();
    });
    btnNone.addEventListener('click', () => {
        drivers.filter(d => state.visibleDriverKeys.has(d.username))
            .forEach(d => state.activeDriverKeys.delete(d.username));
        syncVisibleCheckboxes(body, false);
        callbacks.onDriversChanged();
    });

    // Поиск только прячет строки — выбор участников и график не меняются
    buildSearchBox(body, (q) => applyDriverSearch(q, body), prevQuery);

    /** Оставляет выбранными только видимых (с учётом класса/поиска), прошедших отбор pick. */
    const applyPreset = (pick: (rank: number) => boolean) => {
        const visible = sorted.filter(d => state.visibleDriverKeys.has(d.username));
        const finishers = visible.filter(d => rankOf(d) !== null);
        visible.forEach(d => state.activeDriverKeys.delete(d.username));
        finishers.forEach((d, i) => { if (pick(i + 1)) state.activeDriverKeys.add(d.username); });
        qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
            const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (cb) cb.checked = state.activeDriverKeys.has(item.dataset['driverKey']!);
        });
        callbacks.onDriversChanged();
    };
    const presets = createElement('div', 'filter-presets');
    const addPreset = (label: string, title: string, pick: (rank: number) => boolean) => {
        const btn = createElement('button', 'btn-fa', label);
        btn.title = title;
        btn.addEventListener('click', () => applyPreset(pick));
        presets.appendChild(btn);
    };
    addPreset(t.presetTop(10), t.presetTopTitle(10), r => r <= 10);
    addPreset(t.presetTop(20), t.presetTopTitle(20), r => r <= 20);
    addPreset(t.presetFinished, t.presetFinishedTitle, () => true);
    body.appendChild(presets);

    for (const drv of sorted) {
        const lbl = createElement('label', 'filter-item');
        lbl.dataset['driverKey'] = drv.username;
        lbl.dataset['group']     = drv.group;
        lbl.dataset['car']       = drv.car;
        lbl.dataset['country']   = drv.country;

        const cb = createElement('input') as HTMLInputElement;
        cb.type = 'checkbox'; cb.checked = state.activeDriverKeys.has(drv.username);
        cb.addEventListener('change', () => {
            cb.checked
                ? state.activeDriverKeys.add(drv.username)
                : state.activeDriverKeys.delete(drv.username);
            callbacks.onDriversChanged();
        });

        const rank     = rankOf(drv);
        const place    = createElement('span', rank !== null ? 'filter-driver-rank' : 'filter-driver-rank dnf',
            rank !== null ? String(rank) : t.dnf);
        const content  = createElement('div', 'filter-driver-content');
        const nameSpan = createElement('span', 'filter-driver-name', driverDisplayName(drv));
        prependFlag(nameSpan, drv.country);
        content.appendChild(nameSpan);
        if (drv.car) content.appendChild(createElement('span', 'filter-driver-car', drv.car));

        lbl.appendChild(cb);
        lbl.appendChild(place);
        lbl.appendChild(content);
        body.appendChild(lbl);
    }
    bindDriverHover(body, callbacks);
    wrap.appendChild(group);
}

/**
 * Подсветка линии при наведении на участника — один обработчик на весь список.
 * На сенсорных экранах наведения нет: касание эмулирует mouseover, и подсветка залипала бы.
 */
function bindDriverHover(body: HTMLElement, callbacks: IChartFilterCallbacks): void {
    if (isCoarsePointer()) return;
    const itemOf = (e: Event) =>
        (e.target as HTMLElement | null)?.closest<HTMLElement>('.filter-item[data-driver-key]') ?? null;
    body.addEventListener('mouseover', e => {
        const item = itemOf(e);
        if (!item || item.contains(e.relatedTarget as Node | null)) return;
        item.classList.add('hover-highlighted');
        callbacks.onDriverHover(item.dataset['driverKey']!);
    });
    body.addEventListener('mouseout', e => {
        const item = itemOf(e);
        if (!item || item.contains(e.relatedTarget as Node | null)) return;
        item.classList.remove('hover-highlighted');
        callbacks.onDriverHover(null);
    });
}

/** Фильтр по значению атрибута участника (класс, машина, страна) — общий вид и поведение. */
interface IAttrFilterSpec {
    /** Имя контейнера и счётчика без префикса */
    container:  string;
    counter:    string;
    title:      string;
    /** Значения в порядке показа */
    values:     string[];
    selected:   Set<string>;
    counts:     Map<string, number>;
    labelClass: string;
    labelText:  (value: string) => string;
    decorate?:  (label: HTMLElement, value: string) => void;
}

function buildAttrFilterUI(spec: IAttrFilterSpec, onChange: () => void, prefix: string): void {
    const cont = document.getElementById(filterId(prefix, spec.container))!;
    cont.innerHTML = '';
    // В обе стороны: следующий файл может принести колонку, которой не было в предыдущем
    cont.style.display = spec.values.length ? '' : 'none';
    if (!spec.values.length) return;

    const { group, body, btnAll, btnNone } =
        buildCollapsibleFilterGroup(spec.title, filterId(prefix, spec.counter));

    btnAll.addEventListener('click', () => {
        spec.values.forEach(v => spec.selected.add(v));
        setAllCheckboxes(body, true);
        onChange();
    });
    btnNone.addEventListener('click', () => {
        spec.selected.clear();
        setAllCheckboxes(body, false);
        onChange();
    });

    for (const value of spec.values) {
        const lbl = createElement('label', 'filter-item');
        const cb  = createElement('input') as HTMLInputElement;
        cb.type = 'checkbox'; cb.checked = spec.selected.has(value);
        cb.addEventListener('change', () => {
            cb.checked ? spec.selected.add(value) : spec.selected.delete(value);
            onChange();
        });
        const label = createElement('span', spec.labelClass, spec.labelText(value));
        spec.decorate?.(label, value);
        lbl.appendChild(cb);
        lbl.appendChild(label);
        lbl.appendChild(createFilterCount(spec.counts.get(value) ?? 0));
        body.appendChild(lbl);
    }
    cont.appendChild(group);
}

/** Фильтры класса, машины и страны. onChange — после того, как список участников пересчитан. */
export function buildAttrFilters(
    data:     IParsedRallyData,
    state:    IChartFilterState,
    onChange: () => void,
    prefix:   string,
): void {
    const t = i18n.t();
    // Страны — по названию на языке интерфейса, «не указана» в конце
    const countries = data.countries
        .map(code => ({ code, name: countryName(code) }))
        .sort((a, b) => (a.code ? 0 : 1) - (b.code ? 0 : 1) || a.name.localeCompare(b.name));
    const countryNames = new Map(countries.map(c => [c.code, c.name]));

    buildAttrFilterUI({
        container: 'filter-groups', counter: 'counter-groups', title: t.filterGroupClass,
        values: data.groups, selected: state.activeGroups,
        counts: countBy(data.drivers, d => d.group),
        labelClass: 'filter-group-label', labelText: v => v,
    }, onChange, prefix);
    buildAttrFilterUI({
        container: 'filter-cars', counter: 'counter-cars', title: t.filterCar,
        values: data.cars, selected: state.activeCars,
        counts: countBy(data.drivers, d => d.car),
        labelClass: 'filter-car-label', labelText: v => v,
    }, onChange, prefix);
    buildAttrFilterUI({
        container: 'filter-countries', counter: 'counter-countries', title: t.filterCountry,
        values: countries.map(c => c.code), selected: state.activeCountries,
        counts: countBy(data.drivers, d => d.country),
        labelClass: 'filter-country-label', labelText: v => countryNames.get(v) ?? v,
        decorate: prependFlag,
    }, onChange, prefix);
}

/**
 * Прячет в списке участников тех, кто не проходит фильтры СУ, класса, машины и страны,
 * и обновляет state.visibleDriverKeys (по нему работают «Все/Ничего» и пресеты).
 */
export function refilterDriverList(
    data:      IParsedRallyData,
    state:     IChartFilterState,
    recordMap: TRecordMap,
    prefix:    string,
): void {
    const body = driverListBody(prefix);
    if (!body) return;
    qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
        const ok = passesFilters(data, state, recordMap, {
            username: item.dataset['driverKey']!,
            group:    item.dataset['group']   ?? '',
            car:      item.dataset['car']     ?? '',
            country:  item.dataset['country'] ?? '',
        });
        item.style.display = ok ? '' : 'none';
    });
    reapplyDriverSearch(body);
    refreshVisibleDriverKeys(body, state);
}

function driverListBody(prefix: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`#${filterId(prefix, 'filter-drivers-wrap')} .filter-body`);
}
