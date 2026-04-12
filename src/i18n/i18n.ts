import {
    en,
    hu,
    ru
} from "./translations.js";
import {
    ITranslations,
    Language
} from "./types.js";

const STORAGE_KEY = 'rsf-language';

const TRANSLATIONS: Record<Language, ITranslations> = { ru, en, hu };

type LanguageChangeCallback = (lang: Language) => void;

class I18nService {
    private currentLanguage: Language;
    private callbacks: LanguageChangeCallback[] = [];

    constructor() {
        const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
        this.currentLanguage = stored && stored in TRANSLATIONS
            ? stored
            : this.detectLanguage();
    }

    private detectLanguage(): Language {
        const locale = navigator.language?.toLowerCase() ?? '';
        if (locale.startsWith('ru')) return 'ru';
        if (locale.startsWith('hu')) return 'hu';
        return 'en';
    }
    t(): ITranslations {
        return TRANSLATIONS[this.currentLanguage];
    }

    getLanguage(): Language {
        return this.currentLanguage;
    }

    setLanguage(lang: Language): void {
        if (lang === this.currentLanguage) return;
        this.currentLanguage = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        this.callbacks.forEach(cb => cb(lang));
    }

    onLanguageChange(cb: LanguageChangeCallback): void {
        this.callbacks.push(cb);
    }
}

export const i18n = new I18nService();
