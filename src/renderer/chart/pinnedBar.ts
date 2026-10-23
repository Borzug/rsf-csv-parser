import type { IParsedRallyData } from '../../shared/types';
import { i18n } from "../../i18n/index";
import { driverColor } from '../colors';
import { createElement } from "../dom";

export function updatePinnedBar(
    data:       IParsedRallyData | null,
    pinnedKeys: string[],
    onUnpin:    (key: string) => void,
): void {
    const bar   = document.getElementById('pinned-bar')!;
    const chips = document.getElementById('pinned-chips')!;
    chips.innerHTML = '';

    const drivers = data
        ? pinnedKeys.map(k => data.drivers.find(d => d.username === k)).filter(Boolean)
        : [];
    if (!data || !drivers.length) {
        bar.style.display = 'none';
        return;
    }

    for (const drv of drivers) {
        const chip = createElement('span', 'pinned-chip');
        const dot  = createElement('span', 'pinned-dot');
        dot.style.background = driverColor(data.drivers.indexOf(drv!));
        const name = createElement('span', 'pinned-name',
            drv!.realName && drv!.realName !== drv!.username
                ? `${drv!.username} (${drv!.realName})`
                : drv!.username,
        );
        const x = createElement('button', 'pinned-chip-x', '×');
        x.title = i18n.t().pinnedChipRemove;
        x.addEventListener('click', () => onUnpin(drv!.username));
        chip.appendChild(dot);
        chip.appendChild(name);
        chip.appendChild(x);
        chips.appendChild(chip);
    }

    document.getElementById('pinned-hint')!.textContent = i18n.t().pinnedHint;
    bar.style.display = 'flex';
}
