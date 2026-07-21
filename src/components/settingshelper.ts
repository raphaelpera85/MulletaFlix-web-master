import globalize from 'lib/globalize';

interface LanguageCulture {
    ThreeLetterISOLanguageName: string;
    DisplayName: string;
}

interface SelectElement extends HTMLElement {
    innerHTML: string;
}

/**
 * Helper for handling settings.
 * @module components/settingsHelper
 */

export function populateLanguages(select: SelectElement, languages: LanguageCulture[]): void {
    let html = '';

    html += "<option value=''>" + globalize.translate('AnyLanguage') + '</option>';
    for (let i = 0, length = languages.length; i < length; i++) {
        const culture = languages[i];
        html += "<option value='" + culture.ThreeLetterISOLanguageName + "'>" + culture.DisplayName + '</option>';
    }

    select.innerHTML = html;
}

export default {
    populateLanguages: populateLanguages
};
