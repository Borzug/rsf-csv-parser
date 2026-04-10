import type { IParsedRallyData } from '../../shared/types';
import { driverColor } from '../colors';

export function updatePinnedBar(
    data:       IParsedRallyData | null,
    chart:      any,
    pinnedIdx:  number | null,
): void {
    const bar = document.getElementById('pinned-bar')!;
    if (pinnedIdx === null || !chart || !data) {
        bar.style.display = 'none';
        return;
    }

    const ds  = chart.data.datasets[pinnedIdx];
    const drv = data.drivers.find(d => d.username === ds?.driverKey);
    if (!ds || !drv) { bar.style.display = 'none'; return; }

    const gi = data.drivers.indexOf(drv);
    document.getElementById('pinned-dot')!.style.background = driverColor(gi);
    document.getElementById('pinned-name')!.textContent =
        drv.realName && drv.realName !== drv.username
            ? `${drv.username} (${drv.realName})`
            : drv.username;
    bar.style.display = 'flex';
}
