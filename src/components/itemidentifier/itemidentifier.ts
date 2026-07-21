
/**
 * Module for itemidentifier media item.
 * @module components/itemidentifier/itemidentifier
 */

import escapeHtml from 'escape-html';
import dialogHelper from '../dialogHelper/dialogHelper';
import loading from '../loading/loading';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import scrollHelper from '../../scripts/scrollHelper';
import layoutManager from '../layoutManager';
import focusManager from '../focusManager';
import browser from '../../scripts/browser';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-button/paper-icon-button-light';
import '../formdialog.scss';
import 'material-design-icons-iconfont';
import '../cardbuilder/card.scss';
import toast from '../toast/toast';
import template from './itemidentifier.template.html';
import datetime from '../../scripts/datetime';

const enableFocusTransform: boolean = !browser.slow && !browser.edge;

let currentItem: any;
let currentItemType: string;
let currentServerId: string;
let currentResolve: () => void;
let currentReject: () => void;
let hasChanges = false;
let currentSearchResult: any;

function getApiClient(): any {
    return ServerConnections.getApiClient(currentServerId);
}

function searchForIdentificationResults(page: HTMLElement): void {
    let lookupInfo: any = {
        ProviderIds: {}
    };

    let i: number;
    let length: number;
    const identifyField = page.querySelectorAll('.identifyField') as NodeListOf<HTMLInputElement>;
    let value: string | number;
    for (i = 0, length = identifyField.length; i < length; i++) {
        value = identifyField[i].value;

        if (value) {
            if (identifyField[i].type === 'number') {
                value = parseInt(value as string, 10);
            }

            lookupInfo[identifyField[i].getAttribute('data-lookup')!] = value;
        }
    }

    let hasId = false;

    const txtLookupId = page.querySelectorAll('.txtLookupId') as NodeListOf<HTMLInputElement>;
    for (i = 0, length = txtLookupId.length; i < length; i++) {
        value = txtLookupId[i].value;

        if (value) {
            hasId = true;
        }
        lookupInfo.ProviderIds[txtLookupId[i].getAttribute('data-providerkey')!] = value;
    }

    if (!hasId && !lookupInfo.Name) {
        toast(globalize.translate('PleaseEnterNameOrId'));
        return;
    }

    lookupInfo = {
        SearchInfo: lookupInfo
    };

    if (currentItem?.Id) {
        lookupInfo.ItemId = currentItem.Id;
    } else {
        lookupInfo.IncludeDisabledProviders = true;
    }

    loading.show();

    const apiClient = getApiClient();

    apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`Items/RemoteSearch/${currentItemType}`),
        data: JSON.stringify(lookupInfo),
        contentType: 'application/json',
        dataType: 'json'

    }).then((results: any[]) => {
        loading.hide();
        showIdentificationSearchResults(page, results);
    });
}

function showIdentificationSearchResults(page: HTMLElement, results: any[]): void {
    const identificationSearchResults = page.querySelector('.identificationSearchResults') as HTMLElement;

    (page.querySelector('.popupIdentifyForm') as HTMLElement).classList.add('hide');
    identificationSearchResults.classList.remove('hide');
    (page.querySelector('.identifyOptionsForm') as HTMLElement).classList.add('hide');
    (page.querySelector('.dialogContentInner') as HTMLElement).classList.remove('dialog-content-centered');

    let html = '';
    let i: number;
    let length: number;
    for (i = 0, length = results.length; i < length; i++) {
        const result = results[i];
        html += getSearchResultHtml(result, i);
    }

    const elem = page.querySelector('.identificationSearchResultList') as HTMLElement;
    elem.innerHTML = html;

    function onSearchImageClick(this: HTMLElement): void {
        const index = parseInt(this.getAttribute('data-index')!, 10);

        const currentResult = results[index];

        if (currentItem != null) {
            showIdentifyOptions(page, currentResult);
        } else {
            finishFindNewDialog(page, currentResult);
        }
    }

    const searchImages = elem.querySelectorAll('.card');
    for (i = 0, length = searchImages.length; i < length; i++) {
        searchImages[i].addEventListener('click', onSearchImageClick);
    }

    if (layoutManager.tv) {
        focusManager.autoFocus(identificationSearchResults);
    }
}

function finishFindNewDialog(dlg: HTMLElement, identifyResult: any): void {
    currentSearchResult = identifyResult;
    hasChanges = true;
    loading.hide();

    dialogHelper.close(dlg);
}

function showIdentifyOptions(page: HTMLElement, identifyResult: any): void {
    const identifyOptionsForm = page.querySelector('.identifyOptionsForm') as HTMLElement;

    (page.querySelector('.popupIdentifyForm') as HTMLElement).classList.add('hide');
    (page.querySelector('.identificationSearchResults') as HTMLElement).classList.add('hide');
    identifyOptionsForm.classList.remove('hide');
    (page.querySelector('#chkIdentifyReplaceImages') as HTMLInputElement).checked = true;
    (page.querySelector('.dialogContentInner') as HTMLElement).classList.add('dialog-content-centered');

    currentSearchResult = identifyResult;

    const lines: string[] = [];
    lines.push(escapeHtml(identifyResult.Name));

    if (identifyResult.ProductionYear) {
        lines.push(datetime.toLocaleString(identifyResult.ProductionYear));
    }

    let resultHtml = lines.join('<br/>');

    if (identifyResult.ImageUrl) {
        resultHtml = `<div style="display:flex;align-items:center;"><img src="${identifyResult.ImageUrl}" style="max-height:240px;" /><div style="margin-left:1em;">${resultHtml}</div>`;
    }

    (page.querySelector('.selectedSearchResult') as HTMLElement).innerHTML = resultHtml;

    focusManager.focus(identifyOptionsForm.querySelector('.btnSubmit') as HTMLElement);
}

function getSearchResultHtml(result: any, index: number): string {
    let html = '';
    let cssClass = 'card scalableCard';
    const cardBoxCssClass = 'cardBox';
    let padderClass: string;

    if (currentItemType === 'Episode') {
        cssClass += ' backdropCard backdropCard-scalable';
        padderClass = 'cardPadder-backdrop';
    } else if (currentItemType === 'MusicAlbum' || currentItemType === 'MusicArtist') {
        cssClass += ' squareCard squareCard-scalable';
        padderClass = 'cardPadder-square';
    } else {
        cssClass += ' portraitCard portraitCard-scalable';
        padderClass = 'cardPadder-portrait';
    }

    if (layoutManager.tv) {
        cssClass += ' show-focus';

        if (enableFocusTransform) {
            cssClass += ' show-animation';
        }
    }

    const fullCardBoxCssClass = cardBoxCssClass + ' cardBox-bottompadded';

    html += `<button type="button" class="${cssClass}" data-index="${index}">`;
    html += `<div class="${fullCardBoxCssClass}">`;
    html += '<div class="cardScalable">';
    html += `<div class="${padderClass}"></div>`;

    html += '<div class="cardContent searchImage">';

    if (result.ImageUrl) {
        html += `<div class="cardImageContainer coveredImage" style="background-image:url('${result.ImageUrl}');"></div>`;
    } else {
        html += `<div class="cardImageContainer coveredImage defaultCardBackground defaultCardBackground1"><div class="cardText cardCenteredText">${escapeHtml(result.Name)}</div></div>`;
    }
    html += '</div>';
    html += '</div>';

    let numLines = 3;
    if (currentItemType === 'MusicAlbum') {
        numLines++;
    }

    const lines = [result.Name];

    lines.push(result.SearchProviderName);

    if (result.AlbumArtist) {
        lines.push(result.AlbumArtist.Name);
    }
    if (result.ProductionYear) {
        lines.push(result.ProductionYear);
    }

    for (let i = 0; i < numLines; i++) {
        if (i === 0) {
            html += '<div class="cardText cardText-first cardTextCentered">';
        } else {
            html += '<div class="cardText cardText-secondary cardTextCentered">';
        }
        html += escapeHtml(lines[i] || '') || '&nbsp;';
        html += '</div>';
    }

    html += '</div>';
    html += '</button>';
    return html;
}

function submitIdentficationResult(page: HTMLElement): void {
    loading.show();

    const options = {
        ReplaceAllImages: (page.querySelector('#chkIdentifyReplaceImages') as HTMLInputElement).checked
    };

    const apiClient = getApiClient();

    apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`Items/RemoteSearch/Apply/${currentItem.Id}`, options),
        data: JSON.stringify(currentSearchResult),
        contentType: 'application/json'

    }).then(() => {
        hasChanges = true;
        loading.hide();

        dialogHelper.close(page);
    }, () => {
        loading.hide();

        dialogHelper.close(page);
    });
}

function showIdentificationForm(page: HTMLElement, item: any): void {
    const apiClient = getApiClient();

    apiClient.getJSON(apiClient.getUrl(`Items/${item.Id}/ExternalIdInfos`)).then((idList: any[]) => {
        let html = '';

        for (let i = 0, length = idList.length; i < length; i++) {
            const idInfo = idList[i];

            const id = `txtLookup${idInfo.Key}`;

            html += '<div class="inputContainer">';

            let fullName = idInfo.Name;
            if (idInfo.Type) {
                fullName = `${idInfo.Name} ${globalize.translate(idInfo.Type)}`;
            }

            const idLabel = globalize.translate('LabelDynamicExternalId', escapeHtml(fullName));

            html += `<input is="emby-input" class="txtLookupId" data-providerkey="${idInfo.Key}" id="${id}" label="${idLabel}"/>`;

            html += '</div>';
        }

        (page.querySelector('#txtLookupName') as HTMLInputElement).value = '';

        if (item.Type === 'Person' || item.Type === 'BoxSet') {
            (page.querySelector('.fldLookupYear') as HTMLElement).classList.add('hide');
            (page.querySelector('#txtLookupYear') as HTMLInputElement).value = '';
        } else {
            (page.querySelector('.fldLookupYear') as HTMLElement).classList.remove('hide');
            (page.querySelector('#txtLookupYear') as HTMLInputElement).value = '';
        }

        (page.querySelector('.identifyProviderIds') as HTMLElement).innerHTML = html;

        (page.querySelector('.formDialogHeaderTitle') as HTMLElement).innerHTML = globalize.translate('Identify');
    });
}

function showEditor(itemId: string): void {
    loading.show();

    const apiClient = getApiClient();

    apiClient.getItem(apiClient.getCurrentUserId(), itemId).then((item: any) => {
        currentItem = item;
        currentItemType = currentItem.Type;

        const dialogOptions: any = {
            size: 'small',
            removeOnClose: true,
            scrollY: false
        };

        if (layoutManager.tv) {
            dialogOptions.size = 'fullscreen';
        }

        const dlg = dialogHelper.createDialog(dialogOptions);

        dlg.classList.add('formDialog');
        dlg.classList.add('recordingDialog');

        let html = '';
        html += globalize.translateHtml(template, 'core');

        dlg.innerHTML = html;

        // Has to be assigned a z-index after the call to .open()
        dlg.addEventListener('close', onDialogClosed);

        if (layoutManager.tv) {
            scrollHelper.centerFocus.on(dlg.querySelector('.formDialogContent') as HTMLElement, false);
        }

        if (item.Path) {
            (dlg.querySelector('.fldPath') as HTMLElement).classList.remove('hide');
        } else {
            (dlg.querySelector('.fldPath') as HTMLElement).classList.add('hide');
        }

        (dlg.querySelector('.txtPath') as HTMLElement).innerText = item.Path || '';

        dialogHelper.open(dlg);

        (dlg.querySelector('.popupIdentifyForm') as HTMLFormElement).addEventListener('submit', (e: Event) => {
            e.preventDefault();
            searchForIdentificationResults(dlg);
            return false;
        });

        (dlg.querySelector('.identifyOptionsForm') as HTMLFormElement).addEventListener('submit', (e: Event) => {
            e.preventDefault();
            submitIdentficationResult(dlg);
            return false;
        });

        dlg.querySelector('.btnCancel')!.addEventListener('click', () => {
            dialogHelper.close(dlg);
        });

        dlg.classList.add('identifyDialog');

        showIdentificationForm(dlg, item);
        loading.hide();
    });
}

function onDialogClosed(): void {
    loading.hide();
    if (hasChanges) {
        currentResolve();
    } else {
        currentReject();
    }
}

export function show(itemId: string, serverId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        currentResolve = resolve;
        currentReject = reject;
        currentServerId = serverId;
        hasChanges = false;

        showEditor(itemId);
    });
}

export default {
    show: show
};
