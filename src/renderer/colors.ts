const PALETTE: readonly string[] = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
    '#e67e22', '#e91e63', '#00bcd4', '#8bc34a', '#ff5722', '#e0d44e',
    '#ff9800', '#673ab7', '#03a9f4', '#4caf50', '#ff6d00', '#00e5ff',
    '#d500f9', '#00bfa5', '#ffab40', '#76ff03', '#ef5350', '#42a5f5',
    '#66bb6a', '#ec407a', '#ffa726', '#9ccc65', '#26c6da', '#9575cd',
];

export function driverColor(index: number): string {
    if (index < PALETTE.length) return PALETTE[index];
    const hue = (index * 137.508) % 360;
    const sat = 60 + (index % 3) * 10;
    return `hsl(${Math.round(hue)}, ${sat}%, 52%)`;
}
