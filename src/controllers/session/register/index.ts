import type { ApiClient } from 'jellyfin-apiclient';

import dialogHelper from '../../../components/dialogHelper/dialogHelper';
import layoutManager from '../../../components/layoutManager';
import scrollHelper from '../../../scripts/scrollHelper';
import globalize from '../../../lib/globalize';
import dom from '../../../utils/dom';
import loading from '../../../components/loading/loading';
import toast from '../../../components/toast/toast';

import '../../../elements/emby-button/emby-button';
import '../../../elements/emby-button/paper-icon-button-light';
import '../../../elements/emby-input/emby-input';
import '../../../components/formdialog.scss';

import template from './register.template.html';

interface RegisterData {
    Success?: boolean;
    Message?: string;
}

interface RegisterError {
    Message?: string;
}

function registerUser(apiClient: ApiClient, email: string, password: string): Promise<RegisterData> {
    loading.show();

    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl('/Users/Register'),
        data: JSON.stringify({
            Name: email,
            Password: password
        }),
        contentType: 'application/json'
    } as never).then(function (response: Response) {
        loading.hide();
        return response.json();
    }, function (response: Response) {
        loading.hide();
        if (response.status === 400) {
            return response.json().then(function (data: RegisterData) {
                throw data;
            });
        }
        throw { Message: globalize.translate('MessageRegisterError') };
    });
}

export default function (apiClient: ApiClient | null): void {
    if (!apiClient) {
        toast(globalize.translate('MessageRegisterError'));
        return;
    }

    const dialogOptions: Record<string, unknown> = {
        removeOnClose: true,
        scrollY: false
    };

    if (layoutManager.tv) {
        dialogOptions.size = 'fullscreen';
    }

    const dlg = dialogHelper.createDialog(dialogOptions);

    dlg.classList.add('formDialog');
    dlg.innerHTML = globalize.translateHtml(template, 'core');

    if (layoutManager.tv) {
        scrollHelper.centerFocus.on(dlg.querySelector('.formDialogContent')!, false);
    } else {
        dlg.querySelector('.dialogContentInner')!.classList.add('dialogContentInner-mini');
        dlg.classList.add('dialog-fullscreen-lowres');
    }

    dlg.querySelector('.btnCancel')!.addEventListener('click', function () {
        dialogHelper.close(dlg);
    });

    dlg.querySelector('form')!.addEventListener('submit', function (e: Event) {
        const email: string = (dlg.querySelector('#txtRegisterName') as HTMLInputElement).value.trim().toLowerCase();
        const password: string = (dlg.querySelector('#txtRegisterPassword') as HTMLInputElement).value;
        const confirmPassword: string = (dlg.querySelector('#txtRegisterConfirmPassword') as HTMLInputElement).value;

        if (password !== confirmPassword) {
            toast(globalize.translate('MessageRegisterPasswordsDoNotMatch'));
            e.preventDefault();
            return;
        }

        registerUser(apiClient, email, password).then(function (data: RegisterData) {
            if (data.Success) {
                dialogHelper.close(dlg);
                toast(globalize.translate(data.Message || 'MessageRegisterSuccess'));
            } else {
                toast(globalize.translate(data.Message || 'MessageRegisterError'));
            }
        }, function (error: RegisterError) {
            toast(globalize.translate(error.Message || 'MessageRegisterError'));
        });

        e.preventDefault();
    });

    dlg.style.minWidth = `${Math.min(400, dom.getWindowSize().innerWidth - 50)}px`;

    dialogHelper.open(dlg).then(function () {
        if (layoutManager.tv) {
            scrollHelper.centerFocus.off(dlg.querySelector('.formDialogContent')!, false);
        }
    });
}
