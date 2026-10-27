/**
 * Рисует точки линий (сплиты, финиши, ◆ комментариев) и увеличенную точку под курсором.
 *
 * Если отдать Chart.js размеры/формы/цвета точек массивами, он на каждом update()
 * вычисляет опции отдельно для каждой точки — на сотнях участников это основная
 * часть времени. Поэтому Chart.js получает одно значение на линию (pointRadius: 0,
 * pointHoverRadius: 0), а точки рисуются здесь по массивам ds._ptRadius / _ptStyle / _ptColor.
 *
 * Плагин должен быть зарегистрирован раньше hoverDim: тогда точки рисуются внутри
 * его save/restore и приглушаются вместе с линией.
 */
export function buildPointsPlugin(): object {
    return {
        id: 'points',
        afterDatasetDraw(ch: any, args: any): void {
            const ds = ch.data.datasets[args.index];
            if (!ds || ds.hidden) return;
            const radii  = ds._ptRadius as number[];
            const styles = ds._ptStyle  as string[];
            const colors = ds._ptColor  as string[];
            const { ctx, chartArea: area } = ch;
            const { drawPoint, getHoverColor } = (window as any).Chart.helpers;

            ctx.save();
            // Та же обрезка, что Chart.js применяет к линии: область графика + полтолщины линии
            const m = ds.borderWidth / 2;
            ctx.beginPath();
            ctx.rect(area.left - m, area.top - m, area.right - area.left + 2 * m, area.bottom - area.top + 2 * m);
            ctx.clip();

            const opts = { pointStyle: 'circle', radius: 0, rotation: 0, borderWidth: ds.borderWidth };
            const pts  = args.meta.data as any[];
            const draw = (i: number, radius: number, fill: string, stroke: string, borderWidth: number): void => {
                const pt = pts[i];
                if (!radius || !pt || pt.skip) return;
                // Как у Chart.js: точки за пределами области графика не рисуем
                if (pt.x < area.left - 0.5 || pt.x > area.right + 0.5
                    || pt.y < area.top - 0.5 || pt.y > area.bottom + 0.5) return;
                opts.pointStyle  = styles[i];
                opts.radius      = radius;
                opts.borderWidth = borderWidth;
                ctx.fillStyle    = fill;
                ctx.strokeStyle  = stroke;
                ctx.lineWidth    = borderWidth;
                drawPoint(ctx, opts, pt.x, pt.y);
            };

            for (let i = 0; i < pts.length; i++) draw(i, radii[i], colors[i], ds.borderColor, ds.borderWidth);

            // Точка под курсором — поверх остальных, цвета как у ховера Chart.js
            for (const a of ch.getActiveElements()) {
                if (a.datasetIndex !== args.index) continue;
                draw(a.index, ds._ptHoverRadius, getHoverColor(colors[a.index]), getHoverColor(ds.borderColor), 1);
            }
            ctx.restore();
        },
    };
}
