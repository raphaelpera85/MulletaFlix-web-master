import type { ApiClient } from 'jellyfin-apiclient';

import loading from 'components/loading/loading';
import globalize from 'lib/globalize';
import { ConnectionState, ServerConnections } from 'lib/jellyfin-apiclient';
import type { ConnectResult } from 'lib/jellyfin-apiclient/connectionManager';
import appSettings from 'scripts/settings/appSettings';
import Dashboard from 'utils/dashboard';

import 'elements/emby-button/emby-button';

function handleConnectionResult(page: HTMLElement, result: ConnectResult): void {
    loading.hide();
    switch (result.State) {
        case ConnectionState.SignedIn: {
            const apiClient = result.ApiClient!;
            Dashboard.onServerChanged(apiClient.getCurrentUserId()!, apiClient.accessToken()!, apiClient as never);
            Dashboard.navigate('home');
            break;
        }
        case ConnectionState.ServerSignIn:
            if (result.SystemInfo?.StartupWizardCompleted) {
                Dashboard.navigate('login?serverid=' + result.Servers![0].Id);
            } else {
                Dashboard.navigate('/wizard/start');
            }
            break;
        case ConnectionState.ServerSelection:
            Dashboard.navigate('selectserver');
            break;
        case ConnectionState.ServerUpdateNeeded:
            Dashboard.alert({
                message: globalize.translate('ServerUpdateNeeded', '<a href="https://github.com/MulletaFlix/MulletaFlix">https://github.com/MulletaFlix/MulletaFlix</a>')
            });
            break;
        case ConnectionState.Unavailable:
            Dashboard.alert({
                message: globalize.translate('MessageUnableToConnectToServer'),
                title: globalize.translate('HeaderConnectionFailure')
            });
    }
}

function submitServer(page: HTMLElement): void {
    loading.show();
    const host: string = (page.querySelector('#txtServerHost') as HTMLInputElement).value.replace(/\/+$/, '');
    ServerConnections.connectToAddress(host, {
        enableAutoLogin: appSettings.enableAutoLogin()
    }).then(function(result: ConnectResult) {
        handleConnectionResult(page, result);
    }, function() {
        handleConnectionResult(page, {
            State: ConnectionState.Unavailable
        });
    });
}

export default function(view: HTMLElement): void {
    view.querySelector('.addServerForm')!.addEventListener('submit', onServerSubmit);
    view.querySelector('.btnCancel')!.addEventListener('click', goBack);

    import('../../../components/autoFocuser').then(({ default: autoFocuser }) => {
        autoFocuser.autoFocus(view);
    });

    function onServerSubmit(e: Event): void {
        submitServer(view);
        e.preventDefault();
    }

    function goBack(): void {
        import('../../../components/router/appRouter').then(({ appRouter }) => {
            appRouter.back();
        });
    }
}
