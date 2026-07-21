import escapeHtml from 'escape-html';

import { getLyricsApi } from '@jellyfin/sdk/lib/utils/api/lyrics-api';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import dialogHelper from '../../components/dialogHelper/dialogHelper';
import dom from '../../utils/dom';
import loading from '../../components/loading/loading';
import scrollHelper from '../../scripts/scrollHelper';
import layoutManager from '../layoutManager';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import template from './lyricsuploader.template.html';
import toast from '../toast/toast';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-select/emby-select';
import '../formdialog.scss';
import './lyricsuploader.scss';
import { readFileAsText } from 'utils/file';

let currentItemId: string;
let currentServerId: string;
let currentFile: File | null;
let hasChanges = false;

function onFileReaderError(evt: ProgressEvent<FileReader>): void {
    loading.hide();

    const error = (evt.target as FileReader).error;
    if (error && error.code !== error.ABORT_ERR) {
        toast(globalize.translate('MessageFileReadError'));
    }
}

function isValidLyricsFile(file: File | null): file is File {
    return !!file && ['.lrc', '.txt']
        .some(function (ext) {
            return file.name.endsWith(ext);
        });
}

function setFiles(page: HTMLElement, files: FileList | null): void {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!isValidLyricsFile(file)) {
        page.querySelector('#lyricsOutput')!.innerHTML = '';
        page.querySelector('#fldUpload')!.classList.add('hide');
        page.querySelector('#labelDropLyrics')!.classList.remove('hide');
        currentFile = null;
        return;
    }

    currentFile = file;

    const reader = new FileReader();

    reader.onerror = onFileReaderError;
    reader.onloadstart = function () {
        page.querySelector('#fldUpload')!.classList.add('hide');
    };
    reader.onabort = function () {
        loading.hide();
        console.debug('File read cancelled');
    };

    // Closure to capture the file information.
    reader.onload = (function (theFile: File) {
        return function () {
            // Render file.
            const html = `<div><span class="material-icons lyrics" aria-hidden="true" style="transform: translateY(25%);"></span><span>${escapeHtml(theFile.name)}</span></div>`;

            page.querySelector('#lyricsOutput')!.innerHTML = html;
            page.querySelector('#fldUpload')!.classList.remove('hide');
            page.querySelector('#labelDropLyrics')!.classList.add('hide');
        };
    })(file);

    // Read in the lyrics file as a data URL.
    reader.readAsDataURL(file);
}

async function onSubmit(this: HTMLElement, e: Event): Promise<void> {
    e.preventDefault();
    const file = currentFile;

    if (!isValidLyricsFile(file)) {
        toast(globalize.translate('MessageLyricsFileTypeAllowed'));
        return;
    }

    loading.show();
    const dlg = dom.parentWithClass(this, 'dialog') as HTMLElement;

    const api = toApi(ServerConnections.getApiClient(currentServerId) as any);
    const lyricsApi = getLyricsApi(api);
    const data = await readFileAsText(file);

    lyricsApi.uploadLyrics({
        itemId: currentItemId, fileName: file.name, body: data as any
    }).then(function () {
        (dlg.querySelector('#uploadLyrics') as HTMLInputElement).value = '';
        loading.hide();
        hasChanges = true;
        dialogHelper.close(dlg);
    });
}

function initEditor(page: HTMLElement): void {
    (page.querySelector('.uploadLyricsForm') as HTMLFormElement).addEventListener('submit', onSubmit as EventListener);
    (page.querySelector('#uploadLyrics') as HTMLInputElement).addEventListener('change', function (this: HTMLInputElement) {
        setFiles(page, this.files);
    });
    page.querySelector('.btnBrowse')!.addEventListener('click', function () {
        (page.querySelector('#uploadLyrics') as HTMLInputElement).click();
    });
}

interface LyricsUploaderOptions {
    itemId?: string;
    serverId?: string;
}

function showEditor(options: LyricsUploaderOptions, resolve: (hasChanges: boolean) => void): void {
    options = options || {};
    currentItemId = options.itemId || '';
    currentServerId = options.serverId || '';

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
    dlg.classList.add('lyricsUploaderDialog');

    dlg.innerHTML = globalize.translateHtml(template, 'core');

    if (layoutManager.tv) {
        scrollHelper.centerFocus.on(dlg, false);
    }

    // Has to be assigned a z-index after the call to .open()
    dlg.addEventListener('close', function () {
        if (layoutManager.tv) {
            scrollHelper.centerFocus.off(dlg, false);
        }
        loading.hide();
        resolve(hasChanges);
    });

    dialogHelper.open(dlg);

    initEditor(dlg);

    dlg.querySelector('.btnCancel')!.addEventListener('click', function () {
        dialogHelper.close(dlg);
    });
}

export function show(options: LyricsUploaderOptions): Promise<boolean> {
    return new Promise(function (resolve) {
        hasChanges = false;
        showEditor(options, resolve);
    });
}

export default {
    show
};
