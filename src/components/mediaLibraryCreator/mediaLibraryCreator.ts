
/**
 * Module for media library creator.
 * @module components/mediaLibraryCreator/mediaLibraryCreator
 */

import escapeHtml from 'escape-html';
import loading from '../loading/loading';
import dialogHelper from '../dialogHelper/dialogHelper';
import dom from '../../utils/dom';
import libraryoptionseditor from '../libraryoptionseditor/libraryoptionseditor';
import globalize from '../../lib/globalize';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-select/emby-select';
import '../../elements/emby-toggle/emby-toggle';
import '../listview/listview.scss';
import '../formdialog.scss';
import '../../styles/flexstyles.scss';
import './style.scss';
import toast from '../toast/toast';
import alert from '../alert';
import template from './mediaLibraryCreator.template.html';

let pathInfos: { Path: string; NetworkPath?: string }[] = [];
let currentResolve: (hasChanges: boolean) => void;
let currentOptions: MediaLibraryCreatorOptions;
let hasChanges = false;
let isCreating = false;

function onAddLibrary(this: HTMLElement, e: Event): boolean {
    e.preventDefault();

    if (isCreating) {
        return false;
    }

    if (pathInfos.length == 0) {
        alert({
            text: globalize.translate('PleaseAddAtLeastOneFolder'),
            type: 'error'
        });

        return false;
    }

    isCreating = true;
    loading.show();
    const dlg = dom.parentWithClass(this as HTMLElement, 'dlg-librarycreator') as HTMLElement;
    const name = (dlg.querySelector('#txtValue') as HTMLInputElement).value.trim();
    let type: string | null = (dlg.querySelector('#selectCollectionType') as HTMLSelectElement).value;

    if (name.length === 0) {
        alert({
            text: globalize.translate('LibraryNameInvalid'),
            type: 'error'
        });

        isCreating = false;
        loading.hide();

        return false;
    }

    if (type == 'mixed') {
        type = null;
    }

    const libraryOptions = libraryoptionseditor.getLibraryOptions(dlg.querySelector('.libraryOptions') as HTMLElement);
    (libraryOptions as any).PathInfos = pathInfos;
    (window as any).ApiClient.addVirtualFolder(name, type, currentOptions.refresh, libraryOptions).then(() => {
        hasChanges = true;
        isCreating = false;
        loading.hide();
        dialogHelper.close(dlg);
    }, () => {
        toast(globalize.translate('ErrorAddingMediaPathToVirtualFolder'));

        isCreating = false;
        loading.hide();
    });

    return false;
}

interface CollectionTypeOption {
    value: string;
    name: string;
    message?: string;
}

function getCollectionTypeOptionsHtml(collectionTypeOptions: CollectionTypeOption[]): string {
    return collectionTypeOptions.map(i => {
        return `<option value="${i.value}">${i.name}</option>`;
    }).join('');
}

function initEditor(page: HTMLElement, collectionTypeOptions: CollectionTypeOption[]): void {
    const selectCollectionType = page.querySelector('#selectCollectionType') as HTMLSelectElement;
    selectCollectionType.innerHTML = getCollectionTypeOptionsHtml(collectionTypeOptions);
    selectCollectionType.value = '';
    selectCollectionType.addEventListener('change', function (this: HTMLSelectElement) {
        const value = this.value;
        const dlg = dom.parentWithClass(this, 'dialog') as HTMLElement;
        libraryoptionseditor.setContentType(dlg.querySelector('.libraryOptions') as HTMLElement, value);

        if (value) {
            (dlg.querySelector('.libraryOptions') as HTMLElement).classList.remove('hide');
        } else {
            (dlg.querySelector('.libraryOptions') as HTMLElement).classList.add('hide');
        }

        if (value != 'mixed') {
            const index = this.selectedIndex;

            if (index != -1) {
                const name = this.options[index].innerHTML
                    .replace(/\*/g, '')
                    .replace(/&amp;/g, '&');
                (dlg.querySelector('#txtValue') as HTMLInputElement).value = name;
            }
        }

        const folderOption = collectionTypeOptions.find(i => i.value === value);
        (dlg.querySelector('.collectionTypeFieldDescription') as HTMLElement).innerHTML = folderOption?.message || '';
    });
    page.querySelector('.btnAddFolder')!.addEventListener('click', onAddButtonClick);
    (page.querySelector('.addLibraryForm') as HTMLFormElement).addEventListener('submit', onAddLibrary);
    (page.querySelector('.folderList') as HTMLElement).addEventListener('click', onRemoveClick);
}

function onAddButtonClick(this: HTMLElement): void {
    const page = dom.parentWithClass(this, 'dlg-librarycreator') as HTMLElement;

    import('../directorybrowser/directorybrowser').then(({ default: DirectoryBrowser }) => {
        const picker = new DirectoryBrowser();
        picker.show({
            callback: function (path: string) {
                if (path) {
                    addMediaLocation(page, path);
                }

                picker.close();
            }
        });
    });
}

function getFolderHtml(pathInfo: { Path: string; NetworkPath?: string }, index: number): string {
    let html = '';
    html += '<div class="listItem listItem-border lnkPath">';
    html += `<div class="${pathInfo.NetworkPath ? 'listItemBody two-line' : 'listItemBody'}">`;
    html += `<div class="listItemBodyText" dir="ltr">${escapeHtml(pathInfo.Path)}</div>`;

    if (pathInfo.NetworkPath) {
        html += `<div class="listItemBodyText secondary" dir="ltr">${escapeHtml(pathInfo.NetworkPath)}</div>`;
    }

    html += '</div>';
    html += `<button type="button" is="paper-icon-button-light"" class="listItemButton btnRemovePath" data-index="${index}"><span class="material-icons remove_circle" aria-hidden="true"></span></button>`;
    html += '</div>';
    return html;
}

function renderPaths(page: HTMLElement): void {
    const foldersHtml = pathInfos.map(getFolderHtml).join('');
    const folderList = page.querySelector('.folderList') as HTMLElement;
    folderList.innerHTML = foldersHtml;

    if (foldersHtml) {
        folderList.classList.remove('hide');
    } else {
        folderList.classList.add('hide');
    }
}

function addMediaLocation(page: HTMLElement, path: string): void {
    // If the path already exists in the library, don't add it again.
    const isPathInLibrary = pathInfos.some(p => p.Path === path);
    if (isPathInLibrary) return;

    pathInfos.push({ Path: path });
    renderPaths(page);
}

function onRemoveClick(e: Event): void {
    const button = dom.parentWithClass(e.target as HTMLElement, 'btnRemovePath') as HTMLElement;
    const index = parseInt(button.getAttribute('data-index')!, 10);
    const location = pathInfos[index].Path;
    const locationLower = location.toLowerCase();
    pathInfos = pathInfos.filter(p => {
        return p.Path.toLowerCase() != locationLower;
    });
    renderPaths(dom.parentWithClass(button, 'dlg-librarycreator') as HTMLElement);
}

function onDialogClosed(): void {
    currentResolve(hasChanges);
}

function initLibraryOptions(dlg: HTMLElement): void {
    libraryoptionseditor.embed(dlg.querySelector('.libraryOptions') as HTMLElement, null, null).then(() => {
        (dlg.querySelector('#selectCollectionType') as HTMLElement).dispatchEvent(new Event('change'));
    });
}

interface MediaLibraryCreatorOptions {
    collectionTypeOptions: CollectionTypeOption[];
    refresh?: boolean;
}

export class MediaLibraryCreator {
    constructor(options: MediaLibraryCreatorOptions) {
        return new Promise((resolve) => {
            currentOptions = options;
            currentResolve = resolve as (hasChanges: boolean) => void;
            hasChanges = false;
            const dlg = dialogHelper.createDialog({
                size: 'small',
                modal: false,
                removeOnClose: true,
                scrollY: false
            });
            dlg.classList.add('ui-body-a');
            dlg.classList.add('background-theme-a');
            dlg.classList.add('dlg-librarycreator');
            dlg.classList.add('formDialog');
            dlg.innerHTML = globalize.translateHtml(template);
            initEditor(dlg, options.collectionTypeOptions);
            dlg.addEventListener('close', onDialogClosed);
            dialogHelper.open(dlg);
            dlg.querySelector('.btnCancel')!.addEventListener('click', () => {
                dialogHelper.close(dlg);
            });
            pathInfos = [];
            renderPaths(dlg);
            initLibraryOptions(dlg);
        }) as any;
    }
}

export default MediaLibraryCreator;
