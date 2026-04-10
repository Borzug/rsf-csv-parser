const PALETTE: readonly string[] = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
    '#e67e22', '#e91e63', '#00bcd4', '#8bc34a', '#ff5722', '#e0d44e',
    '#ff9800', '#673ab7', '#03a9f4', '#4caf50', '#ff6d00', '#00e5ff',
    '#d500f9', '#00bfa5', '#ffab40', '#76ff03', '#b71c1c', '#0d47a1',
    '#1b5e20', '#880e4f', '#e65100', '#33691e', '#006064', '#311b92',
];

export function driverColor(index: number): string {
    if (index < PALETTE.length) return PALETTE[index];
    const hue = (index * 137.508) % 360;
    const sat = 60 + (index % 3) * 10;
    return `hsl(${Math.round(hue)}, ${sat}%, 52%)`;
}
