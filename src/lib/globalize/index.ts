import isEmpty from 'lodash-es/isEmpty';

import { currentSettings as userSettings } from 'scripts/settings/userSettings';
import Events from 'utils/events';
import { updateLocale } from 'utils/dateFnsLocale';

const Direction = {
    rtl: 'rtl',
    ltr: 'ltr'
} as const;

export const FALLBACK_CULTURE = 'en-us';
const RTL_LANGS = ['ar', 'fa', 'ur', 'he'];

interface TranslationInfo {
    translations: Array<{ lang: string; path: string }>;
    dictionaries: Record<string, Record<string, string>>;
}

const allTranslations: Record<string, TranslationInfo> = {};
let currentCulture: string | undefined;
let currentDateTimeCulture: string | undefined;
let isRTL = false;

export function getCurrentLocale(): string | undefined {
    return currentCulture;
}

export function getCurrentDateTimeLocale(): string | undefined {
    return currentDateTimeCulture;
}

export function getDefaultLanguage(): string {
    const culture = document.documentElement.getAttribute('data-culture');
    if (culture) {
        return culture;
    }

    if (navigator.language) {
        return navigator.language;
    }
    if ((navigator as Navigator & { userLanguage?: string }).userLanguage) {
        return (navigator as Navigator & { userLanguage: string }).userLanguage;
    }
    if (navigator.languages?.length) {
        return navigator.languages[0];
    }

    return FALLBACK_CULTURE;
}

export function getIsRTL(): boolean {
    return isRTL;
}

function checkAndProcessDir(culture: string): void {
    isRTL = false;
    for (const lang of RTL_LANGS) {
        if (culture.includes(lang)) {
            isRTL = true;
            break;
        }
    }

    setDocumentDirection(isRTL ? Direction.rtl : Direction.ltr);
}

function setDocumentDirection(direction: 'rtl' | 'ltr'): void {
    document.getElementsByTagName('body')[0].setAttribute('dir', direction);
    document.getElementsByTagName('html')[0].setAttribute('dir', direction);
    if (direction === Direction.rtl) {
        import('../../styles/rtl.scss');
    }
}

export function getIsElementRTL(element: HTMLElement): boolean {
    if (window.getComputedStyle) { // all browsers
        return window.getComputedStyle(element, null).getPropertyValue('direction') == 'rtl';
    }
    return (element as HTMLElement & { currentStyle: CSSStyleDeclaration }).currentStyle.direction == 'rtl';
}

export function updateCurrentCulture(): void {
    let culture: string | null | undefined;
    try {
        culture = userSettings.language();
    } catch {
        console.error('no language set in user settings');
    }
    culture = culture || getDefaultLanguage();
    checkAndProcessDir(culture);

    currentCulture = normalizeLocaleName(culture);

    document.documentElement.setAttribute('lang', currentCulture);

    let dateTimeCulture: string | null | undefined;
    try {
        dateTimeCulture = userSettings.dateTimeLocale();
    } catch {
        console.error('no date format set in user settings');
    }

    if (dateTimeCulture) {
        currentDateTimeCulture = normalizeLocaleName(dateTimeCulture);
    } else {
        currentDateTimeCulture = currentCulture;
    }
    updateLocale(currentDateTimeCulture);

    ensureTranslations(currentCulture);
}

function ensureTranslations(culture: string): void {
    for (const i in allTranslations) {
        ensureTranslation(allTranslations[i], culture);
    }
    if (culture !== FALLBACK_CULTURE) {
        for (const i in allTranslations) {
            ensureTranslation(allTranslations[i], FALLBACK_CULTURE);
        }
    }
}

function ensureTranslation(translationInfo: TranslationInfo, culture: string): Promise<void> {
    if (translationInfo.dictionaries[culture]) {
        return Promise.resolve();
    }

    return loadTranslation(translationInfo.translations, culture).then(function (dictionary) {
        translationInfo.dictionaries[culture] = dictionary;
    });
}

export function normalizeLocaleName(culture: string): string {
    return culture.replace('_', '-').toLowerCase();
}

function getDictionary(module: string | undefined, locale: string): Record<string, string> | undefined {
    if (!module) {
        module = defaultModule();
    }
    if (!module) {
        return {};
    }

    const translations = allTranslations[module];
    if (!translations) {
        return {};
    }

    return translations.dictionaries[locale];
}

interface RegisterOptions {
    name: string;
    strings?: Array<{ lang: string; path: string }>;
    translations?: Array<{ lang: string; path: string }>;
}

export function register(options: RegisterOptions): void {
    allTranslations[options.name] = {
        translations: options.strings || options.translations || [],
        dictionaries: {}
    };
}

export function loadStrings(options: string | RegisterOptions): Promise<void[]> {
    const locale = getCurrentLocale()!;
    const promises: Array<Promise<void>> = [];
    let optionsName: string;
    if (typeof options === 'string') {
        optionsName = options;
    } else {
        optionsName = options.name;
        register(options);
    }
    promises.push(ensureTranslation(allTranslations[optionsName], locale));
    promises.push(ensureTranslation(allTranslations[optionsName], FALLBACK_CULTURE));
    return Promise.all(promises);
}

const stringModules = import.meta.glob('../../strings/*.json');

function loadTranslation(translations: Array<{ lang: string; path: string }>, lang: string): Promise<Record<string, string>> {
    lang = normalizeLocaleName(lang);

    let filtered = translations.filter(function (t) {
        return normalizeLocaleName(t.lang) === lang;
    });

    if (!filtered.length) {
        lang = lang.replace(/-.*/, '');

        filtered = translations.filter(function (t) {
            return normalizeLocaleName(t.lang) === lang;
        });

        if (!filtered.length) {
            filtered = translations.filter(function (t) {
                return normalizeLocaleName(t.lang) === FALLBACK_CULTURE;
            });
        }
    }

    return new Promise(function (resolve) {
        if (!filtered.length) {
            resolve({});
            return;
        }

        const url = filtered[0].path;
        const globPath = `../../strings/${url}`;
        const loadFn = stringModules[globPath] as (() => Promise<Record<string, unknown>>) | undefined;

        if (loadFn) {
            loadFn().then((fileContent) => {
                resolve((fileContent.default || fileContent) as Record<string, string>);
            }).catch(() => {
                resolve({});
            });
        } else {
            resolve({});
        }
    });
}

function translateKey(key: string): string {
    const parts = key.split('#');
    let module: string | undefined;

    if (parts.length > 1) {
        module = parts[0];
        key = parts[1];
    }

    return translateKeyFromModule(key, module);
}

function translateKeyFromModule(key: string, module: string | undefined): string {
    let dictionary = getDictionary(module, getCurrentLocale()!);
    if (dictionary?.[key]) {
        return dictionary[key];
    }

    dictionary = getDictionary(module, FALLBACK_CULTURE);
    if (dictionary?.[key]) {
        return dictionary[key];
    }

    if (!dictionary || isEmpty(dictionary)) {
        console.warn('Translation dictionary is empty.');
    } else {
        console.error(`Translation key is missing from dictionary: ${key}`);
    }

    return key;
}

export function translate(key: string, ...args: string[]): string {
    let val = translateKey(key);
    for (let i = 1; i < arguments.length; i++) {
        val = val.replace(new RegExp('\\{' + (i - 1) + '\\}', 'g'), arguments[i].toLocaleString(currentCulture));
    }
    return val;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function translateHtml(html: any, module?: string): any {
    html = html && html.default !== undefined ? html.default : html;

    if (typeof html !== 'string') {
        return html;
    }

    if (!module) {
        module = defaultModule();
    }
    if (!module) {
        throw new Error('module cannot be null or empty');
    }

    let startIndex = html.indexOf('${');
    if (startIndex === -1) {
        return html;
    }

    startIndex += 2;
    const endIndex = html.indexOf('}', startIndex);
    if (endIndex === -1) {
        return html;
    }

    const key = html.substring(startIndex, endIndex);
    const val = translateKeyFromModule(key, module);

    html = html.replace('${' + key + '}', val);
    return translateHtml(html, module);
}

let _defaultModule: string | undefined;
export function defaultModule(val?: string): string | undefined {
    if (val) {
        _defaultModule = val;
    }
    return _defaultModule;
}

updateCurrentCulture();

Events.on(userSettings, 'change', function (e: unknown, name: string) {
    if (name === 'language' || name === 'datetimelocale') {
        updateCurrentCulture();
    }
});

export default {
    translate,
    translateHtml,
    loadStrings,
    defaultModule,
    getCurrentLocale,
    getCurrentDateTimeLocale,
    register,
    updateCurrentCulture,
    getIsRTL,
    getIsElementRTL
};
