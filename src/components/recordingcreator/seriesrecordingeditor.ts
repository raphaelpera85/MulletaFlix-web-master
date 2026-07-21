import dialogHelper from '../dialogHelper/dialogHelper';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import layoutManager from '../layoutManager';
import loading from '../loading/loading';
import scrollHelper from '../../scripts/scrollHelper';
import datetime from '../../scripts/datetime';

import '../../styles/scrollstyles.scss';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-select/emby-select';
import '../../elements/emby-button/paper-icon-button-light';
import '../formdialog.scss';
import './recordingcreator.scss';
import 'material-design-icons-iconfont';
import '../../styles/flexstyles.scss';
import template from './seriesrecordingeditor.template.html';

let currentDialog: HTMLDivElement | null;
let recordingUpdated = false;
let recordingDeleted = false;
let currentItemId: string;
let currentServerId: string;

function deleteTimer(apiClient: any, timerId: string): Promise<void> {
    return new Promise(function (resolve, reject) {
        import('./recordinghelper').then(({ default: recordingHelper }) => {
            recordingHelper.cancelSeriesTimerWithConfirmation(timerId, apiClient.serverId()).then(resolve, reject);
        });
    });
}

function renderTimer(context: Element, item: any): void {
    (context.querySelector('#txtPrePaddingMinutes') as HTMLInputElement).value = String(item.PrePaddingSeconds / 60);
    (context.querySelector('#txtPostPaddingMinutes') as HTMLInputElement).value = String(item.PostPaddingSeconds / 60);

    (context.querySelector('.selectChannels') as HTMLSelectElement).value = item.RecordAnyChannel ? 'all' : 'one';
    (context.querySelector('.selectAirTime') as HTMLSelectElement).value = item.RecordAnyTime ? 'any' : 'original';

    (context.querySelector('.selectShowType') as HTMLSelectElement).value = item.RecordNewOnly ? 'new' : 'all';
    (context.querySelector('.chkSkipEpisodesInLibrary') as HTMLInputElement).checked = item.SkipEpisodesInLibrary;
    (context.querySelector('.selectKeepUpTo') as HTMLSelectElement).value = String(item.KeepUpTo || 0);

    if (item.ChannelName || item.ChannelNumber) {
        (context.querySelector('.optionChannelOnly') as HTMLElement)!.innerText = globalize.translate('ChannelNameOnly', item.ChannelName || item.ChannelNumber);
    } else {
        context.querySelector('.optionChannelOnly')!.innerHTML = globalize.translate('OneChannel');
    }

    (context.querySelector('.optionAroundTime') as HTMLElement)!.innerHTML = globalize.translate('AroundTime', datetime.getDisplayTime(datetime.parseISO8601Date(item.StartDate)));

    loading.hide();
}

function closeDialog(isDeleted: boolean): void {
    recordingUpdated = true;
    recordingDeleted = isDeleted;

    if (currentDialog) {
        dialogHelper.close(currentDialog);
    }
}

function onSubmit(this: any, e: Event): void {
    const form = this;

    const apiClient = ServerConnections.getApiClient(currentServerId) as any;

    apiClient.getLiveTvSeriesTimer(currentItemId).then(function (item: any) {
        item.PrePaddingSeconds = Number((form.querySelector('#txtPrePaddingMinutes') as HTMLInputElement).value) * 60;
        item.PostPaddingSeconds = Number((form.querySelector('#txtPostPaddingMinutes') as HTMLInputElement).value) * 60;
        item.RecordAnyChannel = (form.querySelector('.selectChannels') as HTMLSelectElement).value === 'all';
        item.RecordAnyTime = (form.querySelector('.selectAirTime') as HTMLSelectElement).value === 'any';
        item.RecordNewOnly = (form.querySelector('.selectShowType') as HTMLSelectElement).value === 'new';
        item.SkipEpisodesInLibrary = (form.querySelector('.chkSkipEpisodesInLibrary') as HTMLInputElement).checked;
        item.KeepUpTo = Number((form.querySelector('.selectKeepUpTo') as HTMLSelectElement).value);

        apiClient.updateLiveTvSeriesTimer(item);
    });

    e.preventDefault();

    // Disable default form submission
    return undefined as unknown as void;
}

function init(context: Element): void {
    fillKeepUpTo(context);

    context.querySelector('.btnCancel')!.addEventListener('click', function () {
        closeDialog(false);
    });

    context.querySelector('.btnCancelRecording')!.addEventListener('click', function () {
        const apiClient = ServerConnections.getApiClient(currentServerId) as any;
        deleteTimer(apiClient, currentItemId).then(function () {
            closeDialog(true);
        });
    });

    context.querySelector('form')!.addEventListener('submit', onSubmit);
}

function reload(context: Element, id: string | { Id: string }): void {
    const apiClient = ServerConnections.getApiClient(currentServerId) as any;

    loading.show();
    if (typeof id === 'string') {
        currentItemId = id;

        apiClient.getLiveTvSeriesTimer(id).then(function (result: any) {
            renderTimer(context, result);
            loading.hide();
        });
    } else if (id) {
        currentItemId = id.Id;

        renderTimer(context, id);
        loading.hide();
    }
}

function fillKeepUpTo(context: Element): void {
    let html = '';

    for (let i = 0; i <= 50; i++) {
        let text: string;

        if (i === 0) {
            text = globalize.translate('AsManyAsPossible');
        } else if (i === 1) {
            text = globalize.translate('ValueOneEpisode');
        } else {
            text = globalize.translate('ValueEpisodeCount', String(i));
        }

        html += '<option value="' + i + '">' + text + '</option>';
    }

    context.querySelector('.selectKeepUpTo')!.innerHTML = html;
}

function onFieldChange(this: any): void {
    (this.querySelector('.btnSubmit') as HTMLButtonElement).click();
}

function embed(itemId: string, serverId: string, options?: { context?: HTMLDivElement; enableCancel?: boolean }): void {
    recordingUpdated = false;
    recordingDeleted = false;
    currentServerId = serverId;
    loading.show();
    options = options || {};

    const dlg = options.context!;

    dlg.classList.add('hide');
    dlg.innerHTML = globalize.translateHtml(template, 'core');

    dlg.querySelector('.formDialogHeader')!.classList.add('hide');
    dlg.querySelector('.formDialogFooter')!.classList.add('hide');
    dlg.querySelector('.formDialogContent')!.className = '';
    dlg.querySelector('.dialogContentInner')!.className = '';
    dlg.classList.remove('hide');

    dlg.removeEventListener('change', onFieldChange);
    dlg.addEventListener('change', onFieldChange);

    currentDialog = dlg;

    init(dlg);

    reload(dlg, itemId);
}

function showEditor(itemId: string, serverId: string, options?: { enableCancel?: boolean }): Promise<any> {
    return new Promise(function (resolve, reject) {
        recordingUpdated = false;
        recordingDeleted = false;
        currentServerId = serverId;
        loading.show();
        options = options || {};

        const dialogOptions: Record<string, any> = {
            removeOnClose: true,
            scrollY: false
        };

        if (layoutManager.tv) {
            dialogOptions.size = 'fullscreen';
        } else {
            dialogOptions.size = 'small';
        }

        const dlg = dialogHelper.createDialog(dialogOptions);

        dlg.classList.add('formDialog');
        dlg.classList.add('recordingDialog');

        if (!layoutManager.tv) {
        dlg.style.minWidth = '20%';
        }

        let html = '';

        html += globalize.translateHtml(template, 'core');

        dlg.innerHTML = html;

        if (options.enableCancel === false) {
            dlg.querySelector('.formDialogFooter')!.classList.add('hide');
        }

        currentDialog = dlg;

        dlg.addEventListener('closing', function () {
            if (!recordingDeleted) {
                (dlg.querySelector('.btnSubmit') as HTMLButtonElement).click();
            }
        });

        dlg.addEventListener('close', function () {
            if (recordingUpdated) {
                resolve({
                    updated: true,
                    deleted: recordingDeleted
                });
            } else {
                reject();
            }
        });

        if (layoutManager.tv) {
            scrollHelper.centerFocus.on(dlg.querySelector('.formDialogContent') as HTMLElement, false);
        }

        init(dlg);

        reload(dlg, itemId);

        dialogHelper.open(dlg);
    });
}

export default {
    show: showEditor,
    embed: embed
};
