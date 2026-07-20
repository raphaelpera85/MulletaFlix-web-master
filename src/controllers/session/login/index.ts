import DOMPurify from 'dompurify';
import escapeHtml from 'escape-html';
import markdownIt from 'markdown-it';
import type { ApiClient as ApiClientType } from 'jellyfin-apiclient';

import { AppFeature } from 'constants/appFeature';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import { appHost } from '../../../components/apphost';
import appSettings from '../../../scripts/settings/appSettings';
import dom from '../../../utils/dom';
import loading from '../../../components/loading/loading';
import layoutManager from '../../../components/layoutManager';
import libraryMenu from '../../../scripts/libraryMenu';
import browser from '../../../scripts/browser';
import globalize from '../../../lib/globalize';
import '../../../components/cardbuilder/card.scss';
import '../../../elements/emby-checkbox/emby-checkbox';
import Dashboard from '../../../utils/dashboard';
import toast from '../../../components/toast/toast';
import dialogHelper from '../../../components/dialogHelper/dialogHelper';
import baseAlert from '../../../components/alert';
import { showAdSenseInterstitial } from '../../../components/branding/adsense';
import { getDefaultBackgroundClass } from '../../../components/cardbuilder/utils/builder';

import './login.scss';

const enableFocusTransform: boolean = !browser.slow && !browser.edge;

interface LoginPageParams {
    serverid?: string;
    url?: string;
}

interface AuthResultUser {
    Id: string;
    HasPassword?: boolean;
    Name?: string;
    PrimaryImageTag?: string;
}

interface AuthResult {
    User: AuthResultUser;
    AccessToken: string;
}

interface LicenseInfo {
    IsUnlimited?: boolean;
    IsExpired?: boolean;
    TimeRemaining?: number;
}

interface BrandingOptions {
    LoginDisclaimer?: string;
}

function authenticateUserByName(
    page: HTMLElement,
    apiClient: ApiClientType,
    url: string,
    username: string,
    password: string
): void {
    loading.show();
    apiClient.authenticateUserByName(username, password).then(function (result) {
        const user = result.User!;
        loading.hide();

        onLoginSuccessful(user.Id || '', result.AccessToken || '', apiClient, url);
    }, function (response: Response) {
        (page.querySelector('#txtManualPassword') as HTMLInputElement).value = '';
        loading.hide();

        const UnauthorizedOrForbidden: number[] = [401, 403];
        if (UnauthorizedOrForbidden.includes(response.status)) {
            if (response.status === 401) {
                toast(globalize.translate('MessageInvalidUser'));
                return;
            }

            response.text().then(function (text: string) {
                let message: string = '';

                if (text) {
                    try {
                        const data = JSON.parse(text);
                        message = data.Message || data.message || data.title || '';
                    } catch (error) {
                        message = text;
                    }
                }

                toast(message || globalize.translate('MessageUnauthorizedUser'));
            }).catch(function () {
                toast(globalize.translate('MessageUnauthorizedUser'));
            });
        } else {
            Dashboard.alert({
                message: globalize.translate('MessageUnableToConnectToServer'),
                title: globalize.translate('HeaderConnectionFailure')
            });
        }
    });
}

interface QuickConnectInitResponse {
    Secret: string;
    Code: string;
}

interface QuickConnectAuthData {
    Authenticated: boolean;
    Secret: string;
}

function authenticateQuickConnect(apiClient: ApiClientType, targetUrl: string): void {
    const url: string = apiClient.getUrl('/QuickConnect/Initiate');
    apiClient.ajax({ type: 'POST', url } as never).then((res: Response) => res.json()).then(function (json: QuickConnectInitResponse) {
        if (!json.Secret || !json.Code) {
            console.error('Malformed quick connect response', json);
            return false;
        }

        baseAlert({
            dialogOptions: {
                id: 'quickConnectAlert'
            },
            title: globalize.translate('QuickConnect'),
            text: globalize.translate('QuickConnectAuthorizeCode', json.Code)
        });

        const connectUrl: string = apiClient.getUrl('/QuickConnect/Connect?Secret=' + json.Secret);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
        const interval = setInterval(function() {
            apiClient.getJSON(connectUrl).then(async function(data: QuickConnectAuthData) {
                if (!data.Authenticated) {
                    return;
                }

                clearInterval(interval);

                const dlg = document.getElementById('quickConnectAlert');
                if (dlg) {
                    dialogHelper.close(dlg);
                }

                const result = await apiClient.quickConnect(data.Secret);
                onLoginSuccessful(result.User?.Id || '', result.AccessToken || '', apiClient, targetUrl);
            }, function (e: unknown) {
                clearInterval(interval);

                const dlg = document.getElementById('quickConnectAlert');
                if (dlg) {
                    dialogHelper.close(dlg);
                }

                Dashboard.alert({
                    message: globalize.translate('QuickConnectDeactivated'),
                    title: globalize.translate('HeaderError')
                });

                console.error('Unable to login with quick connect', e);
            });
        }, 5000, connectUrl);

        return true;
    }, function(e: unknown) {
        Dashboard.alert({
            message: globalize.translate('QuickConnectNotActive'),
            title: globalize.translate('HeaderError')
        });

        console.error('Quick connect error: ', e);
        return false;
    });
}

function onLoginSuccessful(id: string, accessToken: string, apiClient: ApiClientType, url: string): void {
    Dashboard.onServerChanged(id, accessToken, apiClient as never);
    Dashboard.navigate(url || 'home');

    apiClient.getJSON(apiClient.getUrl('Users/' + id + '/License')).then(function (license: LicenseInfo) {
        if (!license || license.IsUnlimited) {
            return;
        }

        if (license.IsExpired) {
            toast(globalize.translate('MessageLicenseExpired'));
            return;
        }

        if (license.TimeRemaining) {
            toast(globalize.translate('MessageLicenseTimeRemaining', String(license.TimeRemaining)));
        }
    }).catch(function () {
        // No license or error — silently ignore
    });
}

function showManualForm(context: HTMLElement, showCancel: boolean, focusPassword?: boolean): void {
    (context.querySelector('.chkRememberLogin') as HTMLInputElement).checked = appSettings.enableAutoLogin();
    context.querySelector('.manualLoginForm')!.classList.remove('hide');
    context.querySelector('.visualLoginForm')!.classList.add('hide');
    context.querySelector('.btnManual')!.classList.add('hide');

    if (focusPassword) {
        (context.querySelector('#txtManualPassword') as HTMLInputElement).focus();
    } else {
        (context.querySelector('#txtManualName') as HTMLInputElement).focus();
    }

    if (showCancel) {
        context.querySelector('.btnCancel')!.classList.remove('hide');
    } else {
        context.querySelector('.btnCancel')!.classList.add('hide');
    }
}

interface PublicUser {
    Id: string;
    Name?: string;
    HasPassword?: boolean;
    PrimaryImageTag?: string;
}

function loadUserList(context: HTMLElement, apiClient: ApiClientType, users: PublicUser[]): void {
    let html: string = '';

    for (const user of users) {
        let cssClass: string = 'card squareCard scalableCard squareCard-scalable';

        if (layoutManager.tv) {
            cssClass += ' show-focus';

            if (enableFocusTransform) {
                cssClass += ' show-animation';
            }
        }

        const cardBoxCssClass: string = 'cardBox cardBox-bottompadded';
        html += '<button type="button" class="' + cssClass + '">';
        html += '<div class="' + cardBoxCssClass + '">';
        html += '<div class="cardScalable">';
        html += '<div class="cardPadder cardPadder-square"></div>';
        html += `<div class="cardContent" data-haspw="${user.HasPassword}" data-username="${escapeHtml(user.Name || '')}" data-userid="${user.Id}">`;
        let imgUrl: string;

        if (user.PrimaryImageTag) {
            imgUrl = apiClient.getUserImageUrl(user.Id, {
                width: 300,
                tag: user.PrimaryImageTag,
                type: 'Primary'
            });

            html += '<div class="cardImageContainer coveredImage" style="background-image:url(\'' + imgUrl + "');\"></div>";
        } else {
            html += `<div class="cardImage flex align-items-center justify-content-center ${getDefaultBackgroundClass()}">`;
            html += '<span class="material-icons cardImageIcon person" aria-hidden="true"></span>';
            html += '</div>';
        }

        html += '</div>';
        html += '</div>';
        html += '<div class="cardFooter visualCardBox-cardFooter">';
        html += '<div class="cardText singleCardText cardTextCentered">' + escapeHtml(user.Name || '') + '</div>';
        html += '</div>';
        html += '</div>';
        html += '</button>';
    }

    context.querySelector('#divUsers')!.innerHTML = html;
}

export default function (view: HTMLElement, params: LoginPageParams): void {
    function setHeaderVisibility(hidden: boolean): void {
        const header = document.querySelector('.skinHeader') as HTMLElement | null;

        if (header) {
            header.classList.toggle('hide', hidden);
        }
    }

    function getApiClient(): ApiClientType {
        const serverId: string | undefined = params.serverid;

        if (serverId) {
            return ServerConnections.getOrCreateApiClient(serverId) as unknown as ApiClientType;
        }

        // eslint-disable-next-line no-undef
        return ApiClient;
    }

    function getTargetUrl(): string {
        if (params.url) {
            try {
                return decodeURIComponent(params.url);
            } catch (err) {
                console.warn('[LoginPage] unable to decode url param', params.url, err);
            }
        }

        return '/home';
    }

    function showVisualForm(): void {
        view.querySelector('.visualLoginForm')!.classList.remove('hide');
        view.querySelector('.manualLoginForm')!.classList.add('hide');
        view.querySelector('.btnManual')!.classList.remove('hide');

        import('../../../components/autoFocuser').then(({ default: autoFocuser }) => {
            autoFocuser.autoFocus(view);
        });
    }

    view.querySelector('#divUsers')!.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const card = dom.parentWithClass(target, 'card');
        const cardContent = card ? card.querySelector('.cardContent') : null;

        if (cardContent) {
            const context = view;
            const id = cardContent.getAttribute('data-userid');
            const name = cardContent.getAttribute('data-username');
            const haspw = cardContent.getAttribute('data-haspw');

            if (id === 'manual') {
                (context.querySelector('#txtManualName') as HTMLInputElement).value = '';
                showManualForm(context, true);
            } else if (haspw == 'false') {
                authenticateUserByName(context, getApiClient(), getTargetUrl(), name!, '');
            } else {
                (context.querySelector('#txtManualName') as HTMLInputElement).value = name!;
                (context.querySelector('#txtManualPassword') as HTMLInputElement).value = '';
                showManualForm(context, true, true);
            }
        }
    });
    view.querySelector('.manualLoginForm')!.addEventListener('submit', (e: Event) => {
        appSettings.enableAutoLogin((view.querySelector('.chkRememberLogin') as HTMLInputElement).checked);
        authenticateUserByName(
            view,
            getApiClient(),
            getTargetUrl(),
            (view.querySelector('#txtManualName') as HTMLInputElement).value,
            (view.querySelector('#txtManualPassword') as HTMLInputElement).value
        );
        e.preventDefault();
    });
    view.querySelector('.btnForgotPassword')!.addEventListener('click', () => {
        Dashboard.navigate('forgotpassword');
    });
    view.querySelector('.btnCancel')!.addEventListener('click', showVisualForm);
    view.querySelector('.btnQuick')!.addEventListener('click', () => {
        authenticateQuickConnect(getApiClient(), getTargetUrl());
    });
    view.querySelector('.btnManual')!.addEventListener('click', () => {
        (view.querySelector('#txtManualName') as HTMLInputElement).value = '';
        showManualForm(view, true);
    });
    view.querySelector('.btnRegister')!.addEventListener('click', () => {
        import('../register/index').then(function (registerDialog) {
            registerDialog.default(getApiClient());
        });
    });
    view.querySelector('.btnSelectServer')!.addEventListener('click', () => {
        Dashboard.selectServer();
    });

    view.addEventListener('viewshow', () => {
        loading.show();
        setHeaderVisibility(true);
        libraryMenu.setTransparentMenu(true);

        if (!appHost.supports(AppFeature.MultiServer)) {
            view.querySelector('.btnSelectServer')!.classList.add('hide');
        }

        const apiClient = getApiClient();

        apiClient.getQuickConnect('Enabled')
            .then((enabled: boolean) => {
                if (enabled === true) {
                    view.querySelector('.btnQuick')!.classList.remove('hide');
                }
            })
            .catch(() => {
                console.debug('Failed to get QuickConnect status');
            });

        apiClient.getPublicUsers().then(function (users: unknown[]) {
            if (users.length) {
                showVisualForm();
                loadUserList(view, apiClient, users as PublicUser[]);
            } else {
                (view.querySelector('#txtManualName') as HTMLInputElement).value = '';
                showManualForm(view, false, false);
            }
        }).catch().then(function () {
            loading.hide();
        });
        apiClient.getJSON(apiClient.getUrl('Branding/Configuration')).then(function (options: BrandingOptions) {
            const loginDisclaimer = view.querySelector('.loginDisclaimer') as HTMLElement;

            loginDisclaimer.innerHTML = DOMPurify.sanitize(markdownIt({ html: true }).render(options.LoginDisclaimer || ''));

            for (const elem of loginDisclaimer.querySelectorAll<HTMLAnchorElement>('a')) {
                elem.rel = 'noopener noreferrer';
                elem.target = '_blank';
                elem.classList.add('button-link');
                elem.setAttribute('is', 'emby-linkbutton');

                if (layoutManager.tv) {
                    elem.tabIndex = -1;
                }
            }

            void showAdSenseInterstitial(apiClient, 'login');
        });
    });
    view.addEventListener('viewhide', () => {
        setHeaderVisibility(false);
        libraryMenu.setTransparentMenu(false);
    });
}
