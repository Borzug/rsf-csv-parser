export function qs<T extends Element>(
    sel: string,
    ctx: ParentNode = document,
): T {
    return ctx.querySelector(sel) as T;
}

export function qsa<T extends Element>(
    sel: string,
    ctx: ParentNode = document,
): T[] {
    return Array.from(ctx.querySelectorAll(sel)) as T[];
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

export function createTd(className?: string, text?: string): HTMLTableCellElement {
    return createElement('td', className, text);
}
