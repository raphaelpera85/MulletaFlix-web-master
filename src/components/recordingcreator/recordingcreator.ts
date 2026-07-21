import dialogHelper from '../dialogHelper/dialogHelper';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import layoutManager from '../layoutManager';
import mediaInfo from '../mediainfo/mediainfo';
import loading from '../loading/loading';
import scrollHelper from '../../scripts/scrollHelper';
import datetime from '../../scripts/datetime';
import imageLoader from '../images/imageLoader';
import RecordingFields from './recordingfields';
import Events from '../../utils/events';

import '../../elements/emby-button/emby-button';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-collapse/emby-collapse';
import '../../elements/emby-input/emby-input';
import '../formdialog.scss';
import './recordingcreator.scss';
import 'material-design-icons-iconfont';
import { playbackManager } from '../playback/playbackmanager';
import template from './recordingcreator.template.html';

import PlaceholderImage from './empty.png';

let currentDialog: HTMLDivElement | null;
let closeAction: string | null;
let currentRecordingFields: RecordingFields | null;

function closeDialog(): void {
    if (currentDialog) {
        dialogHelper.close(currentDialog);
    }
}

function init(context: Element): void {
    context.querySelector('.btnPlay')!.addEventListener('click', function () {
        closeAction = 'play';
        closeDialog();
    });

    context.querySelector('.btnCancel')!.addEventListener('click', function () {
        closeAction = null;
        closeDialog();
    });
}

function getImageUrl(item: Record<string, any>, apiClient: any, imageHeight: number): string | null {
    const imageTags: Record<string, any> = item.ImageTags || {};

    if (item.PrimaryImageTag) {
        imageTags.Primary = item.PrimaryImageTag;
    }

    if (imageTags.Primary) {
        return apiClient.getScaledImageUrl(item.Id, {
            type: 'Primary',
            maxHeight: imageHeight,
            tag: item.ImageTags.Primary
        });
    } else if (imageTags.Thumb) {
        return apiClient.getScaledImageUrl(item.Id, {
            type: 'Thumb',
            maxHeight: imageHeight,
            tag: item.ImageTags.Thumb
        });
    }

    return null;
}

function renderRecording(context: Element, defaultTimer: any, program: any, apiClient: any, refreshRecordingStateOnly: boolean): void {
    if (!refreshRecordingStateOnly) {
        const imgUrl = getImageUrl(program, apiClient, 200);
        const imageContainer = context.querySelector('.recordingDialog-imageContainer')!;

        if (imgUrl) {
            imageContainer.innerHTML = `<img src="${PlaceholderImage}" data-src="${imgUrl}" class="recordingDialog-img lazy" />`;
            imageContainer.classList.remove('hide');

            imageLoader.lazyChildren(imageContainer);
        } else {
            imageContainer.innerHTML = '';
            imageContainer.classList.add('hide');
        }

        (context.querySelector('.recordingDialog-itemName') as HTMLElement)!.innerText = program.Name;
        (context.querySelector('.formDialogHeaderTitle') as HTMLElement)!.innerText = program.Name;
        (context.querySelector('.itemGenres') as HTMLElement)!.innerText = (program.Genres || []).join(' / ');
        (context.querySelector('.itemOverview') as HTMLElement)!.innerText = program.Overview || '';

        const formDialogFooter = context.querySelector('.formDialogFooter')!;
        const now = new Date();
        if (now >= datetime.parseISO8601Date(program.StartDate, true) && now < datetime.parseISO8601Date(program.EndDate, true)) {
            formDialogFooter.classList.remove('hide');
        } else {
            formDialogFooter.classList.add('hide');
        }

        context.querySelector('.itemMiscInfoPrimary')!.innerHTML = mediaInfo.getPrimaryMediaInfoHtml(program);
    }

    context.querySelector('.itemMiscInfoSecondary')!.innerHTML = mediaInfo.getSecondaryMediaInfoHtml(program, {
    });

    loading.hide();
}

function reload(context: Element, programId: string, serverId: string, refreshRecordingStateOnly?: boolean): void {
    loading.show();

    const apiClient = ServerConnections.getApiClient(serverId) as any;

    const promise1 = apiClient.getNewLiveTvTimerDefaults({ programId: programId });
    const promise2 = apiClient.getLiveTvProgram(programId, apiClient.getCurrentUserId());

    Promise.all([promise1, promise2]).then(function (responses: any[]) {
        const defaults = responses[0];
        const program = responses[1];

        renderRecording(context, defaults, program, apiClient, !!refreshRecordingStateOnly);
    });
}

function executeCloseAction(action: string | null, programId: string, serverId: string): void {
    if (action === 'play') {
        const apiClient = ServerConnections.getApiClient(serverId) as any;

        apiClient.getLiveTvProgram(programId, apiClient.getCurrentUserId()).then(function (item: any) {
            playbackManager.play({
                ids: [item.ChannelId],
                serverId: serverId
            });
        });
    }
}

function showEditor(itemId: string, serverId: string): Promise<void> {
    return new Promise(function (resolve, reject) {
        closeAction = null;

        loading.show();

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

        let html = '';

        html += globalize.translateHtml(template, 'core');

        dlg.innerHTML = html;

        currentDialog = dlg;

        function onRecordingChanged(): void {
            reload(dlg, itemId, serverId, true);
        }

        dlg.addEventListener('close', function () {
            if (currentRecordingFields) {
                Events.off(currentRecordingFields, 'recordingchanged', onRecordingChanged);
            }
            executeCloseAction(closeAction, itemId, serverId);

            if (currentRecordingFields?.hasChanged()) {
                resolve();
            } else {
                reject();
            }
        });

        if (layoutManager.tv) {
            scrollHelper.centerFocus.on(dlg.querySelector('.formDialogContent') as HTMLElement, false);
        }

        init(dlg);

        reload(dlg, itemId, serverId);

        currentRecordingFields = new RecordingFields({
            parent: dlg.querySelector('.recordingFields')!,
            programId: itemId,
            serverId: serverId
        });

        Events.on(currentRecordingFields, 'recordingchanged', onRecordingChanged);

        dialogHelper.open(dlg);
    });
}

export default {
    show: showEditor
};
