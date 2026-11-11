import type { IDriverInfo, IParsedRallyData, TRecordMap } from '../../shared/types';
import { qsa } from "../dom";

export interface IChartFilterState {
    activeStageNums:   Set<number>;
    activeDriverKeys:  Set<string>;
    activeGroups:      Set<string>;
    activeCars:        Set<string>;
    activeCountries:   Set<string>;
    visibleDriverKeys: Set<string>;
}

export interface IChartFilterCallbacks {
    onStagesChanged:  () => void;
    /** Сменился выбор участников, класса, машины или страны — список СУ тот же. */
    onDriversChanged: () => void;
    onDriverHover:    (key: string | null) => void;
}

/**
 * Проходит ли участник фильтры класса, автомобиля и страны. Одна проверка для графика,
 * результатов и списка участников в боковой панели. «Ничего» везде значит «никого»;
 * участник без класса или машины этими фильтрами не отсекается (выбрать «пустое» значение нельзя).
 */
export function passesAttrFilters(
    data:  IParsedRallyData,
    state: Pick<IChartFilterState, 'activeGroups' | 'activeCars' | 'activeCountries'>,
    drv:   { group: string; car: string; country: string },
): boolean {
    const grpOk = !data.groups.length || !drv.group || state.activeGroups.has(drv.group);
    const carOk = !drv.car || state.activeCars.has(drv.car);
    const ctyOk = !data.countries.length || state.activeCountries.has(drv.country);
    return grpOk && carOk && ctyOk;
}

/**
 * Есть ли у участника строка хотя бы на одном выбранном СУ. Строка значит «стартовал» —
 * сошедший на этом СУ остаётся (как DNF), а сошедший раньше в выбор не попадает.
 */
export function ranSelectedStages(
    data:      IParsedRallyData,
    state:     Pick<IChartFilterState, 'activeStageNums'>,
    recordMap: TRecordMap,
    username:  string,
): boolean {
    if (state.activeStageNums.size === data.stages.length) return true;
    const recs = recordMap.get(username);
    if (!recs) return false;
    for (const sn of state.activeStageNums) if (recs.has(sn)) return true;
    return false;
}

type TFilterDriver = Pick<IDriverInfo, 'username' | 'group' | 'car' | 'country'>;

/**
 * Проходит ли участник фильтры СУ, класса, машины и страны (без ручного выбора в списке).
 * Единственное правило для списка участников в панели, графика, легенды и таблицы.
 */
export function passesFilters(
    data:      IParsedRallyData,
    state:     IChartFilterState,
    recordMap: TRecordMap,
    drv:       TFilterDriver,
): boolean {
    return passesAttrFilters(data, state, drv) && ranSelectedStages(data, state, recordMap, drv.username);
}

/** Показан ли участник: отмечен в списке и проходит фильтры. */
export function isDriverShown(
    data:      IParsedRallyData,
    state:     IChartFilterState,
    recordMap: TRecordMap,
    drv:       TFilterDriver,
): boolean {
    return state.activeDriverKeys.has(drv.username) && passesFilters(data, state, recordMap, drv);
}

/** Состояние «выбрано всё» для данных (или пустое без данных) — так открывается каждая панель. */
export function fullFilterState(data: IParsedRallyData | null): IChartFilterState {
    const keys = data?.drivers.map(d => d.username) ?? [];
    return {
        activeStageNums:   new Set(data?.stages.map(s => s.num) ?? []),
        activeDriverKeys:  new Set(keys),
        activeGroups:      new Set(data?.groups ?? []),
        activeCars:        new Set(data?.cars ?? []),
        activeCountries:   new Set(data?.countries ?? []),
        visibleDriverKeys: new Set(keys),
    };
}

/** id элемента панели фильтров: prefix '' — график, 'res-' — результаты. */
export function filterId(prefix: string, name: string): string {
    return `${prefix}${name}`;
}

export function setAllCheckboxes(body: HTMLElement, value: boolean): void {
    qsa<HTMLInputElement>('input[type="checkbox"]', body)
        .forEach(cb => { cb.checked = value; });
}

export function syncVisibleCheckboxes(body: HTMLElement, value: boolean): void {
    qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
        if (item.style.display !== 'none') {
            const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
            if (cb) cb.checked = value;
        }
    });
}

export function setCounterText(id: string, current: number, total: number): void {
    const el = document.getElementById(id);
    if (el) el.textContent = `(${current}/${total})`;
}

export function setToggleActive(selector: string, active: boolean): void {
    document.querySelector<HTMLButtonElement>(selector)
        ?.classList.toggle('btn-fa-active', active);
}

export function refreshVisibleDriverKeys(body: HTMLElement, state: IChartFilterState): void {
    state.visibleDriverKeys = new Set<string>();
    qsa<HTMLElement>('.filter-item[data-driver-key]', body).forEach(item => {
        if (item.style.display !== 'none')
            state.visibleDriverKeys.add(item.dataset['driverKey']!);
    });
}
