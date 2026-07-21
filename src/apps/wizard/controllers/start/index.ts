import loading from 'components/loading/loading';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import Dashboard from 'utils/dashboard';
import dom from 'utils/dom';

import 'elements/emby-button/emby-button';
import 'elements/emby-select/emby-select';

interface WizardStartPage extends HTMLElement {
    querySelector<T extends Element = Element>(selectors: string): T | null;
}

interface WizardStartSystemInfo {
    ServerName?: string;
}

interface WizardStartConfiguration {
    ServerName?: string;
    UICulture?: string;
}

interface WizardStartLanguageOption {
    Value: string;
    Name: string;
}

interface WizardStartApiClient {
    getPublicSystemInfo(): Promise<WizardStartSystemInfo>;
    getJSON(url: string): Promise<WizardStartConfiguration | WizardStartLanguageOption[]>;
    getUrl(path: string): string;
    ajax(request: {
        type: string;
        data: string;
        url: string;
        contentType: string;
    }): Promise<void>;
}

declare const ApiClient: WizardStartApiClient;

function loadPage(page: WizardStartPage, systemInfo: WizardStartSystemInfo, config: WizardStartConfiguration, languageOptions: WizardStartLanguageOption[]): void {
    const serverNameElem = page.querySelector<HTMLInputElement>('#txtServerName');
    if (serverNameElem) {
        serverNameElem.value = config.ServerName || systemInfo.ServerName || 'Mulletaflix';
    }

    const languageElem = page.querySelector<HTMLSelectElement>('#selectLocalizationLanguage');
    if (languageElem) {
        languageElem.innerHTML = languageOptions.map(function (languageOption) {
            return '<option value="' + languageOption.Value + '">' + languageOption.Name + '</option>';
        }).join('');
        languageElem.value = config.UICulture || '';
    }

    loading.hide();
}

function save(page: WizardStartPage): void {
    loading.show();
    const apiClient = ServerConnections.currentApiClient() as unknown as WizardStartApiClient;

    apiClient.getJSON(apiClient.getUrl('Startup/Configuration')).then(function (config) {
        const typedConfig = config as WizardStartConfiguration;
        const serverNameElem = page.querySelector<HTMLInputElement>('#txtServerName');
        const languageElem = page.querySelector<HTMLSelectElement>('#selectLocalizationLanguage');

        typedConfig.ServerName = serverNameElem?.value || 'Mulletaflix';
        typedConfig.UICulture = languageElem?.value || '';

        apiClient.ajax({
            type: 'POST',
            data: JSON.stringify(typedConfig),
            url: apiClient.getUrl('Startup/Configuration'),
            contentType: 'application/json'
        }).then(function () {
            Dashboard.navigate('wizard/user');
        });
    });
}

function onSubmit(this: HTMLFormElement, e: SubmitEvent): boolean {
    e.preventDefault();
    save(dom.parentWithClass(this, 'page') as WizardStartPage);
    return false;
}

export default function (view: WizardStartPage): void {
    view.querySelector<HTMLFormElement>('.wizardStartForm')?.addEventListener('submit', onSubmit);

    view.addEventListener('viewshow', function () {
        document.querySelector('.skinHeader')?.classList.add('noHomeButtonHeader');
        loading.show();
        const apiClient = ServerConnections.currentApiClient() as unknown as WizardStartApiClient;

        Promise.all([
            apiClient.getPublicSystemInfo(),
            apiClient.getJSON(apiClient.getUrl('Startup/Configuration')),
            apiClient.getJSON(apiClient.getUrl('Localization/Options'))
        ]).then(([ systemInfo, config, languageOptions ]) => {
            loadPage(view, systemInfo, config as WizardStartConfiguration, languageOptions as WizardStartLanguageOption[]);
        });
    });

    view.addEventListener('viewhide', function () {
        document.querySelector('.skinHeader')?.classList.remove('noHomeButtonHeader');
    });
}
