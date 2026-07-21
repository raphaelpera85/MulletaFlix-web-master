import loading from 'components/loading/loading';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import Dashboard from 'utils/dashboard';

import 'elements/emby-checkbox/emby-checkbox';
import 'elements/emby-button/emby-button';
import 'elements/emby-select/emby-select';

interface WizardRemotePage extends HTMLElement {
    querySelector<T extends Element = Element>(selectors: string): T | null;
}

interface WizardRemoteApiClient {
    ajax(request: {
        type: string;
        data: string;
        url: string;
        contentType: string;
    }): Promise<void>;
    getUrl(path: string): string;
}

declare const ApiClient: WizardRemoteApiClient;

function save(page: WizardRemotePage): void {
    loading.show();
    const apiClient = ServerConnections.currentApiClient() as unknown as typeof ApiClient;
    const config = {
        EnableRemoteAccess: (page.querySelector<HTMLInputElement>('#chkRemoteAccess') as HTMLInputElement).checked
    };

    apiClient.ajax({
        type: 'POST',
        data: JSON.stringify(config),
        url: apiClient.getUrl('Startup/RemoteAccess'),
        contentType: 'application/json'
    }).then(function () {
        loading.hide();
        navigateToNextPage();
    });
}

function navigateToNextPage(): void {
    Dashboard.navigate('wizard/finish');
}

function onSubmit(this: WizardRemotePage, e: SubmitEvent): boolean {
    save(this);
    e.preventDefault();
    return false;
}

export default function (view: WizardRemotePage): void {
    view.querySelector<HTMLFormElement>('.wizardSettingsForm')?.addEventListener('submit', onSubmit);
    view.addEventListener('viewshow', function () {
        document.querySelector('.skinHeader')?.classList.add('noHomeButtonHeader');
    });
    view.addEventListener('viewhide', function () {
        document.querySelector('.skinHeader')?.classList.remove('noHomeButtonHeader');
    });
}
