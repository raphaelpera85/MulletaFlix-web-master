import escapeHtml from 'escape-html';

import { getLyricsApi } from '@jellyfin/sdk/lib/utils/api/lyrics-api';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import dialogHelper from '../dialogHelper/dialogHelper';
import layoutManager from '../layoutManager';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import loading from '../loading/loading';
import focusManager from '../focusManager';
import dom from '../../utils/dom';
import '../../elements/emby-select/emby-select';
import '../listview/listview.scss';
import '../../elements/emby-button/paper-icon-button-light';
import '../formdialog.scss';
import 'material-design-icons-iconfont';
import './lyricseditor.scss';
import '../../elements/emby-button/emby-button';
import '../../styles/flexstyles.scss';
import toast from '../toast/toast';
import template from './lyricseditor.template.html';
import templatePreview from './lyricspreview.template.html';
import { deleteLyrics } from '../../scripts/deleteHelper';

let currentItem: any;
let hasChanges: boolean;

function downloadRemoteLyrics(context: HTMLElement, id: string): void {
    const api = toApi(ServerConnections.getApiClient(currentItem.ServerId) as any);
    const lyricsApi = getLyricsApi(api);
    lyricsApi.downloadRemoteLyrics({
        itemId: currentItem.Id,
        lyricId: id
    }).then(function () {
        hasChanges = true;

        toast(globalize.translate('MessageDownloadQueued'));

        focusManager.autoFocus(context);
    });
}

interface LyricEntry {
    Start?: number;
    Text?: string;
}

function getLyricsText(lyricsObject: LyricEntry[]): string {
    return lyricsObject.reduce((htmlAccumulator: string, lyric: LyricEntry) => {
        if (lyric.Start || lyric.Start === 0) {
            const minutes = Math.floor(lyric.Start / 600000000);
            const seconds = Math.floor((lyric.Start % 600000000) / 10000000);
            const hundredths = Math.floor((lyric.Start % 10000000) / 100000);
            htmlAccumulator += '[' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '.' + String(hundredths).padStart(2, '0') + '] ';
        }
        htmlAccumulator += escapeHtml(lyric.Text || '') + '<br/>';
        return htmlAccumulator;
    }, '');
}

interface SearchResult {
    ProviderName: string;
    Id: string;
    Lyrics: {
        Metadata: {
            Artist: string;
            Album: string;
            Title: string;
            Length: number;
            IsSynced: boolean;
        };
        Lyrics: LyricEntry[];
    };
}

function renderSearchResults(context: HTMLElement, results: SearchResult[]): void {
    let lastProvider = '';
    let html = '';

    if (!results.length) {
        (context.querySelector('.noSearchResults') as HTMLElement).classList.remove('hide');
        (context.querySelector('.lyricsResults') as HTMLElement).innerHTML = '';
        loading.hide();
        return;
    }

    (context.querySelector('.noSearchResults') as HTMLElement).classList.add('hide');

    for (let i = 0, length = results.length; i < length; i++) {
        const result = results[i];

        const provider = result.ProviderName;
        const metadata = result.Lyrics.Metadata;
        const lyrics = getLyricsText(result.Lyrics.Lyrics);
        if (provider !== lastProvider) {
            if (i > 0) {
                html += '</div>';
            }
            html += '<h2>' + provider + '</h2>';
            html += '<div>';
            lastProvider = provider;
        }

        const tagName = layoutManager.tv ? 'button' : 'div';
        let className = layoutManager.tv ? 'listItem listItem-border btnOptions' : 'listItem listItem-border';
        if (layoutManager.tv) {
            className += ' listItem-focusscale listItem-button';
        }

        html += '<' + tagName + ' class="' + className + '" data-lyricsid="' + result.Id + '">';

        html += '<span class="listItemIcon material-icons lyrics" aria-hidden="true"></span>';

        html += '<div class="listItemBody three-line">';

        html += '<div>' + escapeHtml(metadata.Artist + ' - ' + metadata.Album + ' - ' + metadata.Title) + '</div>';

        const minutes = Math.floor(metadata.Length / 600000000);
        const seconds = Math.floor((metadata.Length % 600000000) / 10000000);

        html += '<div class="secondary listItemBodyText" style="white-space:pre-line;">' + globalize.translate('LabelDuration') + ': ' + minutes + ':' + String(seconds).padStart(2, '0') + '</div>';

        html += '<div class="secondary listItemBodyText" style="white-space:pre-line;">' + globalize.translate('LabelIsSynced') + ': ' + escapeHtml(metadata.IsSynced ? 'True' : 'False') + '</div>';

        html += '</div>';

        if (!layoutManager.tv) {
            html += '<button type="button" is="paper-icon-button-light" data-lyricsid="' + result.Id + '" class="btnPreview listItemButton"><span class="material-icons preview" aria-hidden="true"></span></button>';
            html += '<button type="button" is="paper-icon-button-light" data-lyricsid="' + result.Id + '" class="btnDownload listItemButton"><span class="material-icons file_download" aria-hidden="true"></span></button>';
        }
        html += '<div class="hide hiddenLyrics">';
        html += '<h2>' + globalize.translate('Lyrics') + '</h2>';
        html += '<div>' + lyrics + '</div>';
        html += '</div>';
        html += '</' + tagName + '>';
    }

    if (results.length) {
        html += '</div>';
    }

    const elem = context.querySelector('.lyricsResults') as HTMLElement;
    elem.innerHTML = html;

    loading.hide();
}

function searchForLyrics(context: HTMLElement): void {
    loading.show();

    const api = toApi(ServerConnections.getApiClient(currentItem.ServerId) as any);
    const lyricsApi = getLyricsApi(api);
    lyricsApi.searchRemoteLyrics({
        itemId: currentItem.Id
    }).then(function (results: any) {
        renderSearchResults(context, results.data);
    });
}

function reload(context: HTMLElement, apiClient: any, itemId: string | any): void {
    (context.querySelector('.noSearchResults') as HTMLElement).classList.add('hide');

    function onGetItem(item: any): void {
        currentItem = item;

        fillCurrentLyrics(context, apiClient, item);
        let file = item.Path || '';
        const index = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));
        if (index > -1) {
            file = file.substring(index + 1);
        }

        if (file) {
            (context.querySelector('.pathValue') as HTMLElement).innerText = file;
            (context.querySelector('.originalFile') as HTMLElement).classList.remove('hide');
        } else {
            (context.querySelector('.pathValue') as HTMLElement).innerHTML = '';
            (context.querySelector('.originalFile') as HTMLElement).classList.add('hide');
        }

        loading.hide();
    }

    if (typeof itemId === 'string') {
        apiClient.getItem(apiClient.getCurrentUserId(), itemId).then(onGetItem);
    } else {
        onGetItem(itemId);
    }
}

function onSearchSubmit(this: HTMLElement, e: Event): boolean {
    const form = this;

    searchForLyrics(dom.parentWithClass(form, 'formDialogContent') as HTMLElement);

    e.preventDefault();
    return false;
}

function onLyricsResultsClick(e: Event): void {
    let lyricsId: string;
    let context: HTMLElement;
    let lyrics: Element;

    const target = e.target as HTMLElement;
    const btnOptions = dom.parentWithClass(target, 'btnOptions');
    if (btnOptions) {
        lyricsId = btnOptions.getAttribute('data-lyricsid')!;
        lyrics = btnOptions.querySelector('.hiddenLyrics')!;
        context = dom.parentWithClass(btnOptions, 'lyricsEditorDialog') as HTMLElement;
        showOptions(btnOptions, context, lyricsId, lyrics.innerHTML);
    }

    const btnPreview = dom.parentWithClass(target, 'btnPreview');
    if (btnPreview) {
        lyrics = btnPreview.parentNode!.querySelector('.hiddenLyrics')!;
        showLyricsPreview(lyrics.innerHTML);
    }

    const btnDownload = dom.parentWithClass(target, 'btnDownload');
    if (btnDownload) {
        lyricsId = btnDownload.getAttribute('data-lyricsid')!;
        context = dom.parentWithClass(btnDownload, 'lyricsEditorDialog') as HTMLElement;
        downloadRemoteLyrics(context, lyricsId);
    }
}

function showLyricsPreview(lyrics: string): void {
    const dialogOptions: any = {
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
    dlg.classList.add('lyricsEditorDialog');

    dlg.innerHTML = globalize.translateHtml(templatePreview, 'core');

    (dlg.querySelector('.lyricsPreview') as HTMLElement).innerHTML = lyrics;

    dlg.querySelector('.btnCancel')!.addEventListener('click', function () {
        dialogHelper.close(dlg);
    });

    dialogHelper.open(dlg);
}

interface ActionSheetItem {
    name: string;
    id: string;
}

function showOptions(button: HTMLElement, context: HTMLElement, lyricsId: string, lyrics: string): void {
    const items: ActionSheetItem[] = [];

    items.push({
        name: globalize.translate('PreviewLyrics'),
        id: 'preview'
    }
    , {
        name: globalize.translate('Download'),
        id: 'download'
    });

    import('../actionSheet/actionSheet').then((actionsheet) => {
        actionsheet.show({
            items: items,
            positionTo: button

        }).then(function (id: unknown) {
            if (id === 'download') {
                downloadRemoteLyrics(context, lyricsId);
            }
            if (id === 'preview') {
                showLyricsPreview(lyrics);
            }
        });
    });
}

function centerFocus(elem: HTMLElement, horiz: boolean, on: boolean): void {
    import('../../scripts/scrollHelper').then(({ default: scrollHelper }) => {
        const fn = on ? 'on' : 'off';
        (scrollHelper as any).centerFocus[fn](elem, horiz);
    });
}

function onOpenUploadMenu(e: Event): void {
    const dialog = dom.parentWithClass(e.target as HTMLElement, 'lyricsEditorDialog') as HTMLElement;
    const apiClient = ServerConnections.getApiClient(currentItem.ServerId);

    import('../lyricsuploader/lyricsuploader').then(({ default: lyricsUploader }) => {
        lyricsUploader.show({
            itemId: currentItem.Id,
            serverId: currentItem.ServerId
        }).then(function (hasChanged: boolean) {
            if (hasChanged) {
                hasChanges = true;
                reload(dialog, apiClient, currentItem.Id);
            }
        });
    });
}

function onDeleteLyrics(e: Event): void {
    deleteLyrics(currentItem).then(() => {
        hasChanges = true;
        const context = dom.parentWithClass(e.target as HTMLElement, 'formDialogContent') as HTMLElement;
        const apiClient = ServerConnections.getApiClient(currentItem.ServerId);
        reload(context, apiClient, currentItem.Id);
    }).catch(() => {
        // delete dialog closed
    });
}

function fillCurrentLyrics(context: HTMLElement, apiClient: any, item: any): void {
    const api = toApi(apiClient);
    const lyricsApi = getLyricsApi(api);
    lyricsApi.getLyrics({
        itemId: item.Id
    }).then((response: any) => {
        if (!response.data.Lyrics) {
            (context.querySelector('.currentLyrics') as HTMLElement).innerHTML = '';
        } else {
            let html = '';
            html += '<h2>' + globalize.translate('Lyrics') + '</h2>';
            html += '<div>';
            html += getLyricsText(response.data.Lyrics);
            html += '</div>';
            (context.querySelector('.currentLyrics') as HTMLElement).innerHTML = html;
        }
    }).catch(() => {
        (context.querySelector('.currentLyrics') as HTMLElement).innerHTML = '';
    });
}

function showEditorInternal(itemId: string, serverId: string): Promise<void> {
    hasChanges = false;
    const apiClient: any = ServerConnections.getApiClient(serverId);
    return apiClient.getItem(apiClient.getCurrentUserId(), itemId).then(function (item: any) {
        const dialogOptions: any = {
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
        dlg.classList.add('lyricsEditorDialog');

        dlg.innerHTML = globalize.translateHtml(template, 'core');

        (dlg.querySelector('.originalLyricsFileLabel') as HTMLElement).innerHTML = globalize.translate('File');

        (dlg.querySelector('.lyricsSearchForm') as HTMLFormElement).addEventListener('submit', onSearchSubmit as EventListener);

        dlg.querySelector('.btnOpenUploadMenu')!.addEventListener('click', onOpenUploadMenu);

        dlg.querySelector('.btnDeleteLyrics')!.addEventListener('click', onDeleteLyrics);

        const btnSubmit = dlg.querySelector('.btnSubmit') as HTMLElement;

        if (layoutManager.tv) {
            centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, true);
            (dlg.querySelector('.btnSearchLyrics') as HTMLElement).classList.add('hide');
        } else {
            btnSubmit.classList.add('hide');
        }
        const editorContent = dlg.querySelector('.formDialogContent') as HTMLElement;

        (dlg.querySelector('.lyricsResults') as HTMLElement).addEventListener('click', onLyricsResultsClick);

        dlg.querySelector('.btnCancel')!.addEventListener('click', function () {
            dialogHelper.close(dlg);
        });

        return new Promise<void>(function (resolve, reject) {
            dlg.addEventListener('close', function () {
                if (layoutManager.tv) {
                    centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, false);
                }

                if (hasChanges) {
                    resolve();
                } else {
                    reject();
                }
            });

            dialogHelper.open(dlg);

            reload(editorContent, apiClient, item);
        });
    });
}

function showEditor(itemId: string, serverId: string): Promise<void> {
    loading.show();

    return showEditorInternal(itemId, serverId);
}

export default {
    show: showEditor
};
