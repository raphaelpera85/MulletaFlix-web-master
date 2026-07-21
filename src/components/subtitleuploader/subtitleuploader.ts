import escapeHtml from 'escape-html';

import { getSubtitleApi } from '@jellyfin/sdk/lib/utils/api/subtitle-api';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import dialogHelper from '../../components/dialogHelper/dialogHelper';
import dom from '../../utils/dom';
import loading from '../../components/loading/loading';
import scrollHelper from '../../scripts/scrollHelper';
import layoutManager from '../layoutManager';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import template from './subtitleuploader.template.html';
import toast from '../toast/toast';

import '../../elements/emby-button/emby-button';
import '../../elements/emby-select/emby-select';
import '../formdialog.scss';
import './style.scss';
import { readFileAsBase64 } from 'utils/file';

let currentItemId: string;
let currentServerId: string;
let currentFile: File | null;
let hasChanges = false;

function onFileReaderError(evt: ProgressEvent<FileReader>): void {
    loading.hide();

    const error = (evt.target as FileReader).error!;
    if (error.code !== error.ABORT_ERR) {
        toast(globalize.translate('MessageFileReadError'));
    }
}

function isValidSubtitleFile(file: File | null): boolean {
    return !!file && ['.sub', '.srt', '.vtt', '.ass', '.ssa', '.mks']
        .some(function (ext) {
            return file.name.endsWith(ext);
        });
}

function setFiles(page: Element, files: FileList): void {
    const file = files[0];

    if (!isValidSubtitleFile(file)) {
        page.querySelector('#subtitleOutput')!.innerHTML = '';
        page.querySelector('#fldUpload')!.classList.add('hide');
        page.querySelector('#labelDropSubtitle')!.classList.remove('hide');
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

    reader.onload = (function (theFile: File) {
        return function () {
            const html = `<div><span class="material-icons subtitles" aria-hidden="true" style="transform: translateY(25%);"></span><span>${escapeHtml(theFile.name)}</span></div>`;

            page.querySelector('#subtitleOutput')!.innerHTML = html;
            page.querySelector('#fldUpload')!.classList.remove('hide');
            page.querySelector('#labelDropSubtitle')!.classList.add('hide');
        };
    })(file);

    reader.readAsDataURL(file);
}

async function onSubmit(this: any, e: Event): Promise<void> {
    e.preventDefault();

    const file = currentFile;

    if (!isValidSubtitleFile(file)) {
        toast(globalize.translate('MessageSubtitleFileTypeAllowed'));
        return;
    }

    loading.show();

    const dlg = dom.parentWithClass(this, 'dialog')!;
    const language = (dlg.querySelector('#selectLanguage') as HTMLSelectElement).value;
    const isForced = (dlg.querySelector('#chkIsForced') as HTMLInputElement).checked;
    const isHearingImpaired = (dlg.querySelector('#chkIsHearingImpaired') as HTMLInputElement).checked;

    const subtitleApi = getSubtitleApi(toApi(ServerConnections.getApiClient(currentServerId) as any));

    const data = await readFileAsBase64(file!);
    const format = file!.name.substring(file!.name.lastIndexOf('.') + 1).toLowerCase();

    subtitleApi.uploadSubtitle({
        itemId: currentItemId,
        uploadSubtitleDto: { Data: data, Language: language, IsForced: isForced, Format: format, IsHearingImpaired: isHearingImpaired }
    }).then(function () {
        (dlg!.querySelector('#uploadSubtitle') as HTMLInputElement).value = '';
        loading.hide();
        hasChanges = true;
        dialogHelper.close(dlg);
    });
}

function initEditor(page: Element): void {
    page.querySelector('.uploadSubtitleForm')!.addEventListener('submit', onSubmit as EventListener);
    page.querySelector('#uploadSubtitle')!.addEventListener('change', function (this: HTMLInputElement) {
        setFiles(page, this.files!);
    });
    page.querySelector('.btnBrowse')!.addEventListener('click', function () {
        (page.querySelector('#uploadSubtitle') as HTMLElement).click();
    });
}

function showEditor(options: SubtitleUploaderOptions, resolve: (value: boolean) => void): void {
    options = options || {};
    currentItemId = options.itemId!;
    currentServerId = options.serverId!;

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
    dlg.classList.add('subtitleUploaderDialog');

    dlg.innerHTML = globalize.translateHtml(template, 'core');

    if (layoutManager.tv) {
        scrollHelper.centerFocus.on(dlg, false);
    }

    dlg.addEventListener('close', function () {
        if (layoutManager.tv) {
            scrollHelper.centerFocus.off(dlg, false);
        }
        loading.hide();
        resolve(hasChanges);
    });

    dialogHelper.open(dlg);

    initEditor(dlg);

    const selectLanguage = dlg.querySelector('#selectLanguage') as HTMLSelectElement;

    if (options.languages) {
        selectLanguage.innerHTML = options.languages.list || null as unknown as string;
        selectLanguage.value = options.languages.value || null as unknown as string;
    }

    dlg.querySelector('.btnCancel')!.addEventListener('click', function () {
        dialogHelper.close(dlg);
    });
}

interface SubtitleUploaderOptions {
    itemId?: string;
    serverId?: string;
    languages?: {
        list?: string;
        value?: string;
    };
}

export function show(options: SubtitleUploaderOptions): Promise<boolean> {
    return new Promise(function (resolve) {
        hasChanges = false;
        showEditor(options, resolve);
    });
}

export default {
    show: show
};
