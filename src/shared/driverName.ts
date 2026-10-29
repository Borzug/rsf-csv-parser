/** Участник с логином и (необязательным) настоящим именем. */
interface INamed {
    username: string;
    realName: string;
}

/** Настоящее имя есть и отличается от логина — его стоит показывать отдельно. */
export function hasRealName(d: INamed): boolean {
    return !!d.realName && d.realName !== d.username;
}

/** «логин (настоящее имя)» или просто логин. */
export function driverDisplayName(d: INamed): string {
    return hasRealName(d) ? `${d.username} (${d.realName})` : d.username;
}
