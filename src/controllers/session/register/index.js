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

function registerUser(apiClient, email, password) {
    loading.show();

    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl('/Users/Register'),
        data: JSON.stringify({
            Name: email,
            Password: password
        }),
        contentType: 'application/json'
    }, true).then(function (response) {
        loading.hide();
        return response.json();
    }, function (response) {
        loading.hide();
        if (response.status === 400) {
            return response.json().then(function (data) {
                throw data;
            });
        }
        throw { Message: globalize.translate('MessageRegisterError') };
    });
}

export default function (apiClient) {
    if (!apiClient) {
        toast(globalize.translate('MessageRegisterError'));
        return;
    }

    const dialogOptions = {
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
        scrollHelper.centerFocus.on(dlg.querySelector('.formDialogContent'), false);
    } else {
        dlg.querySelector('.dialogContentInner').classList.add('dialogContentInner-mini');
        dlg.classList.add('dialog-fullscreen-lowres');
    }

    dlg.querySelector('.btnCancel').addEventListener('click', function () {
        dialogHelper.close(dlg);
    });

    dlg.querySelector('form').addEventListener('submit', function (e) {
        const email = dlg.querySelector('#txtRegisterName').value.trim().toLowerCase();
        const password = dlg.querySelector('#txtRegisterPassword').value;
        const confirmPassword = dlg.querySelector('#txtRegisterConfirmPassword').value;

        if (password !== confirmPassword) {
            toast(globalize.translate('MessageRegisterPasswordsDoNotMatch'));
            e.preventDefault();
            return false;
        }

        registerUser(apiClient, email, password).then(function (data) {
            if (data.Success) {
                dialogHelper.close(dlg);
                toast(globalize.translate(data.Message || 'MessageRegisterSuccess'));
            } else {
                toast(globalize.translate(data.Message || 'MessageRegisterError'));
            }
        }, function (error) {
            toast(globalize.translate(error.Message || 'MessageRegisterError'));
        });

        e.preventDefault();
        return false;
    });

    dlg.style.minWidth = `${Math.min(400, dom.getWindowSize().innerWidth - 50)}px`;

    dialogHelper.open(dlg).then(function () {
        if (layoutManager.tv) {
            scrollHelper.centerFocus.off(dlg.querySelector('.formDialogContent'), false);
        }
    });
}
