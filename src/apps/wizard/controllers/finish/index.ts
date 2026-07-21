import loading from 'components/loading/loading';
import { ServerConnections } from 'lib/jellyfin-apiclient';

interface WizardApiClient {
    ajax(options: { url: string; type: 'POST' }): Promise<void>;
    getUrl(path: string): string;
}

function onFinish(): void {
    loading.show();

    const apiClient = ServerConnections.currentApiClient() as (ReturnType<typeof ServerConnections.currentApiClient> & WizardApiClient) | undefined;
    if (!apiClient) {
        loading.hide();
        return;
    }

    apiClient.ajax({
        url: apiClient.getUrl('Startup/Complete'),
        type: 'POST'
    }).then(() => {
        loading.hide();
        window.location.href = '';
    });
}

export default function (view: HTMLElement): void {
    const nextButton = view.querySelector('.btnWizardNext');
    if (nextButton) {
        nextButton.addEventListener('click', onFinish);
    }
}
