import { qsa } from "../dom";

export interface IChartFilterState {
    activeStageNums:   Set<number>;
    activeDriverKeys:  Set<string>;
    activeGroups:      Set<string>;
    activeCars:        Set<string>;
    visibleDriverKeys: Set<string>;
}

export interface IChartFilterCallbacks {
    onStagesChanged:  () => void;
    onDriversChanged: () => void;
    onGroupsChanged:  () => void;
    onCarsChanged:    () => void;
    onDriverHover:    (key: string | null) => void;
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
