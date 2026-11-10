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

class I18nService {
    private currentLanguage: Language;

    constructor() {
        this.currentLanguage = this.readStored() ?? this.detectLanguage();
    }

    /** Хранилище может быть недоступно (Safari с блокировкой, отключённые cookie) — тогда язык браузера. */
    private readStored(): Language | null {
        try {
            const s = localStorage.getItem(STORAGE_KEY);
            return s && Object.prototype.hasOwnProperty.call(TRANSLATIONS, s) ? s as Language : null;
        } catch {
            return null;
        }
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
        try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* язык просто не запомнится */ }
    }
}

export const i18n = new I18nService();
