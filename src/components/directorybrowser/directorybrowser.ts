import escapeHtml from 'escape-html';
import loading from '../loading/loading';
import dialogHelper from '../dialogHelper/dialogHelper';
import dom from '../../utils/dom';
import globalize from '../../lib/globalize';
import '../listview/listview.scss';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-button/paper-icon-button-light';
import './directorybrowser.scss';
import '../formdialog.scss';
import '../../elements/emby-button/emby-button';
import alert from '../alert';

interface DirectoryEntry {
    Type: string;
    Path: string;
    Name: string;
}

interface DirectoryBrowserOptions {
    includeDirectories?: boolean;
    includeFiles?: boolean;
    path?: string | null;
    pathReadOnly?: boolean;
    instruction?: string;
    header?: string;
    validateWriteable?: boolean;
    callback?: (path: string) => void;
}

interface ApiClientLike {
    getDirectoryContents(path: string, fileOptions: { includeDirectories: boolean; includeFiles?: boolean }): Promise<DirectoryEntry[]>;
    getParentPath(path: string): Promise<string>;
    getDrives(): Promise<DirectoryEntry[]>;
    getJSON(url: string): Promise<{ Path?: string }>;
    getUrl(path: string): string;
    ajax(options: {
        type: string;
        url: string;
        data: string;
        contentType: string;
    }): Promise<void>;
}

declare const ApiClient: ApiClientLike;

function onDialogClosed(): void {
    loading.hide();
}

function getResultsElement(page: HTMLDivElement): HTMLDivElement {
    return page.querySelector<HTMLDivElement>('.results')!;
}

function getPathInput(page: HTMLDivElement): HTMLInputElement {
    return page.querySelector<HTMLInputElement>('#txtDirectoryPickerPath')!;
}

function refreshDirectoryBrowser(page: HTMLDivElement, path: string | undefined, fileOptions: { includeDirectories: boolean; includeFiles?: boolean }, updatePathOnError?: boolean): void {
    if (path && typeof path !== 'string') {
        throw new Error('invalid path');
    }

    loading.show();

    const promises: Array<Promise<DirectoryEntry[] | string>> = [];

    if (path) {
        promises.push(ApiClient.getDirectoryContents(path, fileOptions));
        promises.push(ApiClient.getParentPath(path));
    } else {
        promises.push(ApiClient.getDrives());
    }

    Promise.all(promises).then((responses) => {
        const folders = responses[0] as DirectoryEntry[];
        const parentPath = (responses[1] ? JSON.parse(responses[1] as string) : '') || '';
        let html = '';

        getResultsElement(page).scrollTop = 0;
        getPathInput(page).value = path || '';

        if (path) {
            html += getItem('lnkPath lnkDirectory', '', parentPath, '...');
        }
        for (let i = 0, length = folders.length; i < length; i++) {
            const folder = folders[i];
            const cssClass = folder.Type === 'File' ? 'lnkPath lnkFile' : 'lnkPath lnkDirectory';
            html += getItem(cssClass, folder.Type, folder.Path, folder.Name);
        }

        getResultsElement(page).innerHTML = html;
        loading.hide();
    }, () => {
        if (updatePathOnError) {
            getPathInput(page).value = '';
            getResultsElement(page).innerHTML = '';
            loading.hide();
        }
    });
}

function getItem(cssClass: string, type: string, path: string, name: string): string {
    let html = '';
    html += `<div class="listItem listItem-border ${cssClass}" data-type="${type}" data-path="${escapeHtml(path)}">`;
    html += '<div class="listItemBody" style="padding-left:0;padding-top:.5em;padding-bottom:.5em;">';
    html += '<div class="listItemBodyText">';
    html += escapeHtml(name);
    html += '</div>';
    html += '</div>';
    html += '<span class="material-icons arrow_forward" aria-hidden="true" style="font-size:inherit;"></span>';
    html += '</div>';
    return html;
}

function getEditorHtml(options: DirectoryBrowserOptions): string {
    let html = '';
    html += '<div class="formDialogContent scrollY">';
    html += '<div class="dialogContentInner dialog-content-centered" style="padding-top:2em;">';
    if (!options.pathReadOnly && options.instruction) {
        const instruction = `${escapeHtml(options.instruction)}<br/><br/>`;
        html += '<div class="infoBanner" style="margin-bottom:1.5em;">';
        html += instruction;
        html += '</div>';
    }
    html += '<form style="margin:auto;">';
    html += '<div class="inputContainer" style="display: flex; align-items: center;">';
    html += '<div style="flex-grow:1;">';
    const labelKey = options.includeFiles !== true ? 'LabelFolder' : 'LabelPath';
    const readOnlyAttribute = options.pathReadOnly ? ' readonly' : '';
    html += `<input is="emby-input" id="txtDirectoryPickerPath" type="text" required="required" ${readOnlyAttribute} label="${globalize.translate(labelKey)}"/>`;
    html += '</div>';
    if (!readOnlyAttribute) {
        html += `<button type="button" is="paper-icon-button-light" class="btnRefreshDirectories emby-input-iconbutton" title="${globalize.translate('Refresh')}"><span class="material-icons search" aria-hidden="true"></span></button>`;
    }
    html += '</div>';
    if (!readOnlyAttribute) {
        html += '<div class="results paperList" style="max-height: 200px; overflow-y: auto;"></div>';
    }
    html += '<div class="formDialogFooter">';
    html += `<button is="emby-button" type="submit" class="raised button-submit block formDialogFooterItem">${globalize.translate('ButtonOk')}</button>`;
    html += '</div>';
    html += '</form>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    return html;
}

function alertText(text: string): void {
    alert({
        text
    });
}

function validatePath(path: string, validateWriteable: boolean, apiClient: ApiClientLike): Promise<void> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl('Environment/ValidatePath'),
        data: JSON.stringify({
            ValidateWriteable: validateWriteable,
            Path: path
        }),
        contentType: 'application/json'
    }).catch((response: { status?: number } | undefined) => {
        if (response) {
            if (response.status === 404) {
                alertText(globalize.translate('PathNotFound'));
                return Promise.reject();
            }
            if (response.status === 500) {
                if (validateWriteable) {
                    alertText(globalize.translate('WriteAccessRequired'));
                } else {
                    alertText(globalize.translate('PathNotFound'));
                }
                return Promise.reject();
            }
        }
        return Promise.resolve();
    });
}

function initEditor(content: HTMLDivElement, options: DirectoryBrowserOptions, fileOptions: { includeDirectories: boolean; includeFiles?: boolean }): void {
    content.addEventListener('click', (e) => {
        const lnkPath = dom.parentWithClass(e.target as HTMLElement, 'lnkPath');
        if (lnkPath) {
            const path = lnkPath.getAttribute('data-path') || '';
            if (lnkPath.classList.contains('lnkFile')) {
                getPathInput(content).value = path;
            } else {
                refreshDirectoryBrowser(content, path, fileOptions, true);
            }
        }
    });

    content.addEventListener('click', (e) => {
        if (dom.parentWithClass(e.target as HTMLElement, 'btnRefreshDirectories')) {
            refreshDirectoryBrowser(content, getPathInput(content).value, fileOptions);
        }
    });

    content.addEventListener('change', (e) => {
        const txtDirectoryPickerPath = dom.parentWithTag(e.target as HTMLElement, 'INPUT');
        if (txtDirectoryPickerPath && txtDirectoryPickerPath.id === 'txtDirectoryPickerPath') {
            refreshDirectoryBrowser(content, (txtDirectoryPickerPath as HTMLInputElement).value, fileOptions);
        }
    });

    content.querySelector('form')!.addEventListener('submit', function (e) {
        if (options.callback) {
            const path = (this.querySelector('#txtDirectoryPickerPath') as HTMLInputElement).value;
            validatePath(path, !!options.validateWriteable, ApiClient)
                .then(() => options.callback?.(path))
                .catch(() => { /* no-op */ });
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
}

function getDefaultPath(options: DirectoryBrowserOptions): Promise<string> {
    if (options.path) {
        return Promise.resolve(options.path);
    }

    return ApiClient.getJSON(ApiClient.getUrl('Environment/DefaultDirectoryBrowser')).then((result) => {
        return result.Path || '';
    }, () => {
        return '';
    });
}

class DirectoryBrowser {
    currentDialog: HTMLDivElement | null = null;

    show = (options: DirectoryBrowserOptions = {}): void => {
        const fileOptions: { includeDirectories: boolean; includeFiles?: boolean } = {
            includeDirectories: true
        };

        if (options.includeDirectories != null) {
            fileOptions.includeDirectories = options.includeDirectories;
        }
        if (options.includeFiles != null) {
            fileOptions.includeFiles = options.includeFiles;
        }

        getDefaultPath(options).then((fetchedInitialPath) => {
            const dlg = dialogHelper.createDialog({
                size: 'small',
                removeOnClose: true,
                scrollY: false
            }) as HTMLDivElement;

            dlg.classList.add('ui-body-a');
            dlg.classList.add('background-theme-a');
            dlg.classList.add('directoryPicker');
            dlg.classList.add('formDialog');

            let html = '';
            html += '<div class="formDialogHeader">';
            html += `<button is="paper-icon-button-light" class="btnCloseDialog autoSize" tabindex="-1" title="${globalize.translate('ButtonBack')}"><span class="material-icons arrow_back" aria-hidden="true"></span></button>`;
            html += '<h3 class="formDialogHeaderTitle">';
            html += escapeHtml(options.header || '') || globalize.translate('HeaderSelectPath');
            html += '</h3>';
            html += '</div>';
            html += getEditorHtml(options);
            dlg.innerHTML = html;
            initEditor(dlg, options, fileOptions);
            dlg.addEventListener('close', onDialogClosed);
            dialogHelper.open(dlg);
            dlg.querySelector('.btnCloseDialog')?.addEventListener('click', () => {
                dialogHelper.close(dlg);
            });
            this.currentDialog = dlg;
            getPathInput(dlg).value = fetchedInitialPath;
            if (!options.pathReadOnly) {
                refreshDirectoryBrowser(dlg, fetchedInitialPath, fileOptions, true);
            }
        });
    };

    close = (): void => {
        if (this.currentDialog) {
            dialogHelper.close(this.currentDialog);
        }
    };
}

export default DirectoryBrowser;
