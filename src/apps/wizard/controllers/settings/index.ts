import loading from 'components/loading/loading';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import Dashboard from 'utils/dashboard';

import 'elements/emby-button/emby-button';
import 'elements/emby-checkbox/emby-checkbox';
import 'elements/emby-select/emby-select';

interface WizardSettingsLanguage {
    Name: string;
    DisplayName: string;
}

interface WizardSettingsCountry {
    TwoLetterISORegionName: string;
    DisplayName: string;
}

interface WizardSettingsConfiguration {
    PreferredMetadataLanguage?: string;
    MetadataCountryCode?: string;
}

type WizardSettingsApiClient = NonNullable<ReturnType<typeof ServerConnections.currentApiClient>> & {
    ajax(request: {
        type: string;
        data: string;
        url: string;
        contentType: string;
    }): Promise<void>;
    getCountries(): Promise<WizardSettingsCountry[]>;
    getCultures(): Promise<WizardSettingsLanguage[]>;
    getJSON<T>(url: string): Promise<T>;
    getUrl(path: string, params?: Record<string, string | undefined>): string;
};

function save(context: HTMLElement): void {
    loading.show();
    const apiClient = ServerConnections.currentApiClient() as WizardSettingsApiClient;
    const config = apiClient.getJSON<WizardSettingsConfiguration>(apiClient.getUrl('Startup/Configuration'));
    const selectLanguage = context.querySelector<HTMLSelectElement>('#selectLanguage');
    const selectCountry = context.querySelector<HTMLSelectElement>('#selectCountry');

    config.then(function (currentConfig) {
        currentConfig.PreferredMetadataLanguage = selectLanguage?.value || '';
        currentConfig.MetadataCountryCode = selectCountry?.value || '';

        apiClient.ajax({
            type: 'POST',
            data: JSON.stringify(currentConfig),
            url: apiClient.getUrl('Startup/Configuration'),
            contentType: 'application/json'
        }).then(function () {
            loading.hide();
            navigateToNextPage();
        });
    });
}

function populateLanguages(select: HTMLSelectElement, languages: WizardSettingsLanguage[]): void {
    let html = '';
    html += "<option value=''></option>";

    for (let i = 0, length = languages.length; i < length; i++) {
        const culture = languages[i];
        html += "<option value='" + culture.Name + "' data-culture-name='" + culture.Name + "'>" + culture.DisplayName + '</option>';
    }

    select.innerHTML = html;
}

function populateCountries(select: HTMLSelectElement, allCountries: WizardSettingsCountry[]): void {
    let html = '';
    html += "<option value=''></option>";

    for (let i = 0, length = allCountries.length; i < length; i++) {
        const culture = allCountries[i];
        html += "<option value='" + culture.TwoLetterISORegionName + "'>" + culture.DisplayName + '</option>';
    }

    select.innerHTML = html;
}

function syncMetadataLanguageFromCountry(page: HTMLElement): Promise<string> {
    const apiClient = ServerConnections.currentApiClient() as WizardSettingsApiClient;
    const countryCode = page.querySelector<HTMLSelectElement>('#selectCountry')?.value || '';

    if (!countryCode) {
        return Promise.resolve('');
    }

    return apiClient.getJSON<string>(apiClient.getUrl('Localization/DefaultMetadataLanguage', {
        countryCode
    })).then(function (language) {
        const selectLanguage = page.querySelector<HTMLSelectElement>('#selectLanguage');
        const shouldPreferBrazilianPortuguese = countryCode.toUpperCase() === 'BR';

        if (shouldPreferBrazilianPortuguese && selectLanguage) {
            const preferredOption = Array.from(selectLanguage.options).find(function (option) {
                return (option.textContent || option.innerText || '').trim() === 'Portuguese (Brazil)';
            });

            if (preferredOption) {
                selectLanguage.value = preferredOption.value;
                return preferredOption.value || 'pt-BR';
            }

            selectLanguage.value = 'pt-BR';
            return 'pt-BR';
        }

        if (language && selectLanguage) {
            selectLanguage.value = language;
        }

        return language || '';
    }).catch(function () {
        return '';
    });
}

function reloadData(page: HTMLElement, config: WizardSettingsConfiguration, cultures: WizardSettingsLanguage[], countries: WizardSettingsCountry[]): void {
    const selectLanguage = page.querySelector<HTMLSelectElement>('#selectLanguage');
    const selectCountry = page.querySelector<HTMLSelectElement>('#selectCountry');

    if (selectLanguage) {
        populateLanguages(selectLanguage, cultures);
        selectLanguage.value = config.PreferredMetadataLanguage || '';
    }

    if (selectCountry) {
        populateCountries(selectCountry, countries);
        selectCountry.value = config.MetadataCountryCode || '';
    }

    if (config.MetadataCountryCode) {
        void syncMetadataLanguageFromCountry(page);
    }

    loading.hide();
}

function reload(page: HTMLElement): void {
    loading.show();
    const apiClient = ServerConnections.currentApiClient() as WizardSettingsApiClient;

    Promise.all([
        apiClient.getJSON<WizardSettingsConfiguration>(apiClient.getUrl('Startup/Configuration')),
        apiClient.getCultures(),
        apiClient.getCountries()
    ]).then(function (responses) {
        reloadData(page, responses[0], responses[1], responses[2]);
    });
}

function navigateToNextPage(): void {
    Dashboard.navigate('wizard/remoteaccess');
}

function onSubmit(this: HTMLFormElement, e: SubmitEvent): boolean {
    save(this);
    e.preventDefault();
    return false;
}

export default function (view: HTMLElement): void {
    view.querySelector<HTMLFormElement>('.wizardSettingsForm')?.addEventListener('submit', onSubmit);
    view.querySelector<HTMLSelectElement>('#selectCountry')?.addEventListener('change', function () {
        void syncMetadataLanguageFromCountry(view);
    });
    view.addEventListener('viewshow', function () {
        document.querySelector('.skinHeader')?.classList.add('noHomeButtonHeader');
        reload(view);
    });
    view.addEventListener('viewhide', function () {
        document.querySelector('.skinHeader')?.classList.remove('noHomeButtonHeader');
    });
}
