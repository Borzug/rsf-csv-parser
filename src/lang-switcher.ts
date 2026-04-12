import {
    i18n,
    Language
} from "./i18n/index";

export function initLangSwitcher(onChanged: () => void): void {
    const switcher = document.getElementById('lang-switcher');
    if (!switcher) return;

    updateActiveLangButton(switcher, i18n.getLanguage());

    switcher.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.lang-btn');
        if (!btn) return;
        const lang = btn.dataset['lang'] as Language | undefined;
        if (!lang) return;
        i18n.setLanguage(lang);
        updateActiveLangButton(switcher, lang);
        onChanged();
    });
}

function updateActiveLangButton(switcher: HTMLElement, lang: Language): void {
    switcher.querySelectorAll<HTMLElement>('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset['lang'] === lang);
    });
}
