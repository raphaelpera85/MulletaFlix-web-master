import loading from 'components/loading/loading';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import Dashboard from 'utils/dashboard';

import 'elements/emby-button/emby-button';
import 'elements/emby-checkbox/emby-checkbox';
import 'elements/emby-select/emby-select';

function save(page) {
    loading.show();
    const apiClient = ServerConnections.currentApiClient();
    apiClient.getJSON(apiClient.getUrl('Startup/Configuration')).then(function (config) {
        config.PreferredMetadataLanguage = page.querySelector('#selectLanguage').value;
        config.MetadataCountryCode = page.querySelector('#selectCountry').value;
        apiClient.ajax({
            type: 'POST',
            data: JSON.stringify(config),
            url: apiClient.getUrl('Startup/Configuration'),
            contentType: 'application/json'
        }).then(function () {
            loading.hide();
            navigateToNextPage();
        });
    });
}

function populateLanguages(select, languages) {
    let html = '';
    html += "<option value=''></option>";

    for (let i = 0, length = languages.length; i < length; i++) {
        const culture = languages[i];
        html += "<option value='" + culture.Name + "'>" + culture.DisplayName + '</option>';
    }

    select.innerHTML = html;
}

function populateCountries(select, allCountries) {
    let html = '';
    html += "<option value=''></option>";

    for (let i = 0, length = allCountries.length; i < length; i++) {
        const culture = allCountries[i];
        html += "<option value='" + culture.TwoLetterISORegionName + "'>" + culture.DisplayName + '</option>';
    }

    select.innerHTML = html;
}

function syncMetadataLanguageFromCountry(page) {
    const apiClient = ServerConnections.currentApiClient();
    const countryCode = page.querySelector('#selectCountry').value;
    if (!countryCode) {
        return Promise.resolve('');
    }

    return apiClient.getJSON(apiClient.getUrl('Localization/DefaultMetadataLanguage', {
        countryCode
    })).then(language => {
        if (language) {
            page.querySelector('#selectLanguage').value = language;
        }
        return language || '';
    }).catch(() => {
        return '';
    });
}

function resolveLanguageSelection(language, countryCode, cultures) {
    if (!language) {
        return '';
    }

    if (language.toLowerCase() === 'pt' && countryCode && countryCode.toUpperCase() === 'BR') {
        return 'pt-BR';
    }

    const exactCulture = cultures.find(culture => culture.Name.toLowerCase() === language.toLowerCase());
    if (exactCulture) {
        return exactCulture.Name;
    }

    const normalized = language.replace('_', '-');
    const normalizedCulture = cultures.find(culture => culture.Name.toLowerCase() === normalized.toLowerCase());
    if (normalizedCulture) {
        return normalizedCulture.Name;
    }

    const languagePrefix = normalized.split('-')[0];
    const fallbackCulture = cultures.find(culture => culture.TwoLetterISOLanguageName.toLowerCase() === languagePrefix.toLowerCase());
    return fallbackCulture ? fallbackCulture.Name : language;
}

function reloadData(page, config, cultures, countries) {
    populateLanguages(page.querySelector('#selectLanguage'), cultures);
    populateCountries(page.querySelector('#selectCountry'), countries);
    page.querySelector('#selectLanguage').value = resolveLanguageSelection(config.PreferredMetadataLanguage, config.MetadataCountryCode, cultures);
    page.querySelector('#selectCountry').value = config.MetadataCountryCode;
    if (!config.PreferredMetadataLanguage && config.MetadataCountryCode) {
        void syncMetadataLanguageFromCountry(page);
    }
    loading.hide();
}

function reload(page) {
    loading.show();
    const apiClient = ServerConnections.currentApiClient();
    const promise1 = apiClient.getJSON(apiClient.getUrl('Startup/Configuration'));
    const promise2 = apiClient.getCultures();
    const promise3 = apiClient.getCountries();
    Promise.all([promise1, promise2, promise3]).then(function (responses) {
        reloadData(page, responses[0], responses[1], responses[2]);
    });
}

function navigateToNextPage() {
    Dashboard.navigate('wizard/remoteaccess');
}

function onSubmit(e) {
    save(this);
    e.preventDefault();
    return false;
}

export default function (view) {
    view.querySelector('.wizardSettingsForm').addEventListener('submit', onSubmit);
    view.querySelector('#selectCountry').addEventListener('change', function () {
        void syncMetadataLanguageFromCountry(view);
    });
    view.addEventListener('viewshow', function () {
        document.querySelector('.skinHeader').classList.add('noHomeButtonHeader');
        reload(this);
    });
    view.addEventListener('viewhide', function () {
        document.querySelector('.skinHeader').classList.remove('noHomeButtonHeader');
    });
}

