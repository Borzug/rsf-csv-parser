import { i18n } from "../i18n/index.js";

export function applyDomTranslations(): void {
    const t = i18n.t();

    setTextById('welcome-title',        t.welcomeTitle);
    setTextById('welcome-desc',         t.welcomeDesc);
    setTextById('btn-choose-file',      t.selectFileButton);
    setTextById('sidebar-filters-label', t.filtersLabel);
    setTextById('btn-back',             t.backButton);
    setTextById('tab-chart',            t.tabChart);
    setTextById('tab-results',          t.tabResults);
    setTextById('tab-comments',         t.tabComments);
    setTextById('btn-apply-filter',     t.applyFilterButton);

    setTextById('chart-legend-success',    t.chartLegendSuccess);
    setTextById('chart-legend-sr',         t.chartLegendSuperRally);
    setTextById('chart-legend-comment',    t.chartLegendComment);

    setTitleById('pinned-close',           t.pinnedCloseTitle);
    setTitleById('legend-expand-btn',      t.legendExpandTitle);

    applyEventNameLabel(t.eventNameLabel, t.eventNameOptional);
}

function setTextById(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setTitleById(id: string, title: string): void {
    const el = document.getElementById(id);
    if (el) el.title = title;
}

function applyEventNameLabel(label: string, optional: string): void {
    const el = document.getElementById('label-event-name');
    if (!el) return;
    const span = el.querySelector<HTMLElement>('.optional');
    const textNode = el.childNodes[0];
    if (textNode?.nodeType === Node.TEXT_NODE) {
        textNode.textContent = `${label} `;
    }
    if (span) span.textContent = optional;
}
