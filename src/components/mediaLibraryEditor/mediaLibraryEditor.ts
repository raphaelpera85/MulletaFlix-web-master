/**
 * Module for media library editor.
 * @module components/mediaLibraryEditor/mediaLibraryEditor
 */

import escapeHtml from 'escape-html';
import $ from 'jquery';
import loading from '../loading/loading';
import dialogHelper from '../dialogHelper/dialogHelper';
import dom from '../../utils/dom';
import libraryoptionseditor from '../libraryoptionseditor/libraryoptionseditor';
import globalize from '../../lib/globalize';
import '../../elements/emby-button/emby-button';
import '../listview/listview.scss';
import '../../elements/emby-button/paper-icon-button-light';
import '../formdialog.scss';
import '../../elements/emby-toggle/emby-toggle';
import '../../styles/flexstyles.scss';
import './style.scss';
import alert from '../alert';
import toast from '../toast/toast';
import confirm from '../confirm/confirm';
import template from './mediaLibraryEditor.template.html';

let currentDeferred: any;
let currentOptions: MediaLibraryEditorOptions;
let hasChanges = false;
let isCreating = false;

// eslint-disable-next-line sonarjs/no-invariant-returns
function onEditLibrary(this: HTMLElement): boolean {
    if (isCreating) {
        return false;
    }

    isCreating = true;
    loading.show();
    const dlg = dom.parentWithClass(this, 'dlg-libraryeditor') as HTMLElement;
    // when the library has moved or symlinked, the ItemId is not correct anymore
    // this can lead to a forever spinning value on edit the library parameters
    if (!currentOptions.library.ItemId) {
        loading.hide();
        dialogHelper.close(dlg);
        alert({
            text: globalize.translate('LibraryInvalidItemIdError')
        });
        return false;
    }
    let libraryOptions = libraryoptionseditor.getLibraryOptions(dlg.querySelector('.libraryOptions') as HTMLElement);
    libraryOptions = Object.assign(currentOptions.library.LibraryOptions || {}, libraryOptions);
    (window as any).ApiClient.updateVirtualFolderOptions(currentOptions.library.ItemId, libraryOptions).then(() => {
        hasChanges = true;
        isCreating = false;
        loading.hide();
        dialogHelper.close(dlg);
    }, () => {
        isCreating = false;
        loading.hide();
    });
    return false;
}

function addMediaLocation(page: HTMLElement, path: string): void {
    const virtualFolder = currentOptions.library;
    const refreshAfterChange = currentOptions.refresh;

    // If the path already exists in the library, don't add it again.
    const isPathInLibrary = virtualFolder.Locations.some((p: string) => path === p);
    if (isPathInLibrary) return;

    (window as any).ApiClient.addMediaPath(virtualFolder.Name, path, null, refreshAfterChange).then(() => {
        hasChanges = true;
        refreshLibraryFromServer(page);
    }, () => {
        toast(globalize.translate('ErrorAddingMediaPathToVirtualFolder'));
    });
}

function updateMediaLocation(page: HTMLElement, path: string): void {
    const virtualFolder = currentOptions.library;
    (window as any).ApiClient.updateMediaPath(virtualFolder.Name, {
        Path: path
    }).then(() => {
        hasChanges = true;
        refreshLibraryFromServer(page);
    }, () => {
        toast(globalize.translate('ErrorAddingMediaPathToVirtualFolder'));
    });
}

function onRemoveClick(btnRemovePath: HTMLElement, location: string): void {
    const button = btnRemovePath;
    const virtualFolder = currentOptions.library;

    confirm({
        title: globalize.translate('HeaderRemoveMediaLocation'),
        text: globalize.translate('MessageConfirmRemoveMediaLocation'),
        confirmText: globalize.translate('Delete'),
        primary: 'delete'
    }).then(() => {
        const refreshAfterChange = currentOptions.refresh;
        (window as any).ApiClient.removeMediaPath(virtualFolder.Name, location, refreshAfterChange).then(() => {
            hasChanges = true;
            refreshLibraryFromServer(dom.parentWithClass(button, 'dlg-libraryeditor') as HTMLElement);
        }, () => {
            toast(globalize.translate('ErrorDefault'));
        });
    });
}

function onListItemClick(e: Event): void {
    const listItem = dom.parentWithClass(e.target as HTMLElement, 'listItem');

    if (listItem) {
        const index = parseInt(listItem.getAttribute('data-index')!, 10);
        const pathInfos = currentOptions.library.LibraryOptions?.PathInfos || [];
        const pathInfo = index == null ? ({} as any) : pathInfos[index] || {};
        const originalPath = pathInfo.Path || (index == null ? null : currentOptions.library.Locations[index]);
        const btnRemovePath = dom.parentWithClass(e.target as HTMLElement, 'btnRemovePath');

        if (btnRemovePath) {
            onRemoveClick(btnRemovePath, originalPath);
            return;
        }

        showDirectoryBrowser(dom.parentWithClass(listItem, 'dlg-libraryeditor') as HTMLElement, originalPath);
    }
}

function getFolderHtml(pathInfo: { Path: string; NetworkPath?: string }, index: number): string {
    let html = '';
    html += `<div class="listItem listItem-border lnkPath" data-index="${index}">`;
    html += `<div class="${pathInfo.NetworkPath ? 'listItemBody two-line' : 'listItemBody'}">`;
    html += '<h3 class="listItemBodyText">';
    html += escapeHtml(pathInfo.Path);
    html += '</h3>';

    if (pathInfo.NetworkPath) {
        html += `<div class="listItemBodyText secondary">${escapeHtml(pathInfo.NetworkPath)}</div>`;
    }

    html += '</div>';
    html += `<button type="button" is="paper-icon-button-light" class="listItemButton btnRemovePath" data-index="${index}"><span class="material-icons remove_circle" aria-hidden="true"></span></button>`;
    html += '</div>';
    return html;
}

function refreshLibraryFromServer(page: HTMLElement): void {
    (window as any).ApiClient.getVirtualFolders().then((result: any[]) => {
        const library = result.filter(f => {
            return f.Name === currentOptions.library.Name;
        })[0];

        if (library) {
            currentOptions.library = library;
            renderLibrary(page, currentOptions);
        }
    });
}

function renderLibrary(page: HTMLElement, options: MediaLibraryEditorOptions): void {
    let pathInfos = options.library.LibraryOptions?.PathInfos || [];

    if (!pathInfos.length) {
        pathInfos = options.library.Locations.map((p: string) => {
            return {
                Path: p
            };
        });
    }

    if (options.library.CollectionType === 'boxsets') {
        (page.querySelector('.folders') as HTMLElement).classList.add('hide');
    } else {
        (page.querySelector('.folders') as HTMLElement).classList.remove('hide');
    }

    (page.querySelector('.folderList') as HTMLElement).innerHTML = pathInfos.map(getFolderHtml).join('');
}

function onAddButtonClick(this: HTMLElement): void {
    showDirectoryBrowser(dom.parentWithClass(this, 'dlg-libraryeditor') as HTMLElement);
}

function showDirectoryBrowser(context: HTMLElement, originalPath?: string): void {
    import('../directorybrowser/directorybrowser').then(({ default: DirectoryBrowser }) => {
        const picker = new DirectoryBrowser();
        picker.show({
            pathReadOnly: originalPath != null,
            path: originalPath,
            callback: function (path: string) {
                if (path) {
                    if (originalPath) {
                        updateMediaLocation(context, originalPath);
                    } else {
                        addMediaLocation(context, path);
                    }
                }

                picker.close();
            }
        });
    });
}

function initEditor(dlg: HTMLElement, options: MediaLibraryEditorOptions): void {
    renderLibrary(dlg, options);
    (dlg.querySelector('.btnAddFolder') as HTMLElement).addEventListener('click', onAddButtonClick);
    (dlg.querySelector('.folderList') as HTMLElement).addEventListener('click', onListItemClick);
    (dlg.querySelector('.btnSubmit') as HTMLElement).addEventListener('click', onEditLibrary as EventListener);
    libraryoptionseditor.embed(dlg.querySelector('.libraryOptions') as HTMLElement, options.library.CollectionType, options.library.LibraryOptions);
}

function onDialogClosed(): void {
    currentDeferred.resolveWith(null, [hasChanges]);
}

interface LibraryOptions {
    PathInfos?: { Path: string; NetworkPath?: string }[];
    [key: string]: any;
}

interface LibraryInfo {
    ItemId?: string;
    Name: string;
    CollectionType?: string;
    Locations: string[];
    LibraryOptions?: LibraryOptions;
    [key: string]: any;
}

interface MediaLibraryEditorOptions {
    library: LibraryInfo;
    refresh?: boolean;
}

export class MediaLibraryEditor {
    constructor(options: MediaLibraryEditorOptions) {
        const deferred = $.Deferred();
        currentOptions = options;
        currentDeferred = deferred;
        hasChanges = false;
        const dlg = dialogHelper.createDialog({
            size: 'small',
            modal: false,
            removeOnClose: true,
            scrollY: false
        });
        dlg.classList.add('dlg-libraryeditor');
        dlg.classList.add('ui-body-a');
        dlg.classList.add('background-theme-a');
        dlg.classList.add('formDialog');
        dlg.innerHTML = globalize.translateHtml(template);
        (dlg.querySelector('.formDialogHeaderTitle') as HTMLElement).innerText = options.library.Name;
        initEditor(dlg, options);
        dlg.addEventListener('close', onDialogClosed);
        dialogHelper.open(dlg);
        dlg.querySelector('.btnCancel')!.addEventListener('click', () => {
            dialogHelper.close(dlg);
        });
        refreshLibraryFromServer(dlg);
        return deferred.promise() as any;
    }
}

export default MediaLibraryEditor;
