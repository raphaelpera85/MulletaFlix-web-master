import loading from 'components/loading/loading';
import toast from 'components/toast/toast';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import Dashboard from 'utils/dashboard';

import 'styles/dashboard.scss';
import 'elements/emby-input/emby-input';
import 'elements/emby-button/emby-button';

interface WizardUserPage extends HTMLElement {
    querySelector<T extends Element = Element>(selectors: string): T | null;
}

interface WizardUserApiClient {
    ajax(request: {
        type: string;
        data: string;
        url: string;
        contentType: string;
    }): Promise<void>;
    getUrl(path: string): string;
    getJSON(url: string): Promise<{ Name?: string; Password?: string }>;
}

declare const ApiClient: WizardUserApiClient;

function nextWizardPage(): void {
    Dashboard.navigate('wizard/library')
        .catch(err => {
            console.error('[Wizard > User] error navigating to library setup', err);
        });
}

function onUpdateUserComplete(result: unknown): void {
    console.debug('[Wizard > User] user update complete:', result);
    loading.hide();
    nextWizardPage();
}

async function onUpdateUserError(result: Response): Promise<void> {
    const message = await result.text();
    console.warn('[Wizard > User] user update failed:', message);
    toast(globalize.translate('ErrorDefault'));
    loading.hide();
}

function submit(form: WizardUserPage): void {
    loading.show();
    const apiClient = ServerConnections.currentApiClient() as unknown as WizardUserApiClient;
    const usernameInput = form.querySelector<HTMLInputElement>('#txtUsername');
    const passwordInput = form.querySelector<HTMLInputElement>('#txtManualPassword');

    apiClient
        .ajax({
            type: 'POST',
            data: JSON.stringify({
                Name: usernameInput?.value.trim() || '',
                Password: passwordInput?.value || ''
            }),
            url: apiClient.getUrl('Startup/User'),
            contentType: 'application/json'
        })
        .then(onUpdateUserComplete)
        .catch(onUpdateUserError);
}

function onSubmit(this: HTMLFormElement, e: SubmitEvent): boolean {
    const form = this;
    const password = form.querySelector<HTMLInputElement>('#txtManualPassword')?.value || '';
    const confirmPassword = form.querySelector<HTMLInputElement>('#txtPasswordConfirm')?.value || '';

    if (password != confirmPassword) {
        toast(globalize.translate('PasswordMatchError'));
    } else {
        submit(form.parentElement as WizardUserPage);
    }

    e.preventDefault();
    return false;
}

function onViewShow(this: WizardUserPage): void {
    loading.show();
    const page = this;
    const apiClient = ServerConnections.currentApiClient() as unknown as WizardUserApiClient;
    apiClient.getJSON(apiClient.getUrl('Startup/User')).then(function (user) {
        const usernameInput = page.querySelector<HTMLInputElement>('#txtUsername');
        const manualPasswordInput = page.querySelector<HTMLInputElement>('#txtManualPassword');

        if (usernameInput) {
            usernameInput.value = user.Name || '';
        }
        if (manualPasswordInput) {
            manualPasswordInput.value = user.Password || '';
        }

        loading.hide();
    });
}

export default function (view: WizardUserPage): void {
    view.querySelector<HTMLFormElement>('.wizardUserForm')?.addEventListener('submit', onSubmit);
    view.addEventListener('viewshow', function () {
        document.querySelector('.skinHeader')?.classList.add('noHomeButtonHeader');
    });
    view.addEventListener('viewhide', function () {
        document.querySelector('.skinHeader')?.classList.remove('noHomeButtonHeader');
    });
    view.addEventListener('viewshow', onViewShow);
}
