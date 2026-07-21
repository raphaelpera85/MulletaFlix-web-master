import { AppFeature } from 'constants/appFeature';
import dom from '../../utils/dom';
import loading from '../loading/loading';
import { appHost } from '../apphost';
import dialogHelper from '../dialogHelper/dialogHelper';
import imageLoader from '../images/imageLoader';
import browser from '../../scripts/browser';
import layoutManager from '../layoutManager';
import scrollHelper from '../../scripts/scrollHelper';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-button/emby-button';
import '../formdialog.scss';
import '../cardbuilder/card.scss';
import template from './imageDownloader.template.html';

const enableFocusTransform: boolean = !browser.slow && !browser.edge;

let currentItemId: string;
let currentItemType: string;
let currentResolve: () => void;
let currentReject: () => void;
let hasChanges = false;

// These images can be large and we're seeing memory problems in safari
const browsableImagePageSize: number = browser.slow ? 6 : 30;

let browsableImageStartIndex = 0;
let browsableImageType = 'Primary';
let selectedProvider: string | null;
let browsableParentId: string;

interface RemoteOptions {
    itemId?: string;
    type?: string;
    startIndex?: number;
    limit?: number;
    IncludeAllLanguages?: boolean;
    ProviderName?: string;
    Type?: string;
    ImageUrl?: string;
}

function getBaseRemoteOptions(page: HTMLElement, forceCurrentItemId = false): RemoteOptions {
    const options: RemoteOptions = {};

    if (!forceCurrentItemId && (page.querySelector('#chkShowParentImages') as HTMLInputElement).checked && browsableParentId) {
        options.itemId = browsableParentId;
    } else {
        options.itemId = currentItemId;
    }

    return options;
}

function reloadBrowsableImages(page: HTMLElement, apiClient: any): void {
    loading.show();

    const options = getBaseRemoteOptions(page);

    options.type = browsableImageType;
    options.startIndex = browsableImageStartIndex;
    options.limit = browsableImagePageSize;
    options.IncludeAllLanguages = (page.querySelector('#chkAllLanguages') as HTMLInputElement).checked;

    const provider = selectedProvider || '';

    if (provider) {
        options.ProviderName = provider;
    }

    apiClient.getAvailableRemoteImages(options).then(function (result: any) {
        renderRemoteImages(page, apiClient, result, browsableImageType, options.startIndex!, options.limit!);

        (page.querySelector('#selectBrowsableImageType') as HTMLSelectElement).value = browsableImageType;

        const providersHtml = result.Providers.map(function (p: string) {
            return '<option value="' + p + '">' + p + '</option>';
        });

        const selectImageProvider = page.querySelector('#selectImageProvider') as HTMLSelectElement;
        selectImageProvider.innerHTML = '<option value="">' + globalize.translate('All') + '</option>' + providersHtml;
        selectImageProvider.value = provider;

        loading.hide();
    });
}

function renderRemoteImages(page: HTMLElement, apiClient: any, imagesResult: any, imageType: string, startIndex: number, limit: number): void {
    (page.querySelector('.availableImagesPaging') as HTMLElement).innerHTML = getPagingHtml(startIndex, limit, imagesResult.TotalRecordCount);

    let html = '';

    for (let i = 0, length = imagesResult.Images.length; i < length; i++) {
        html += getRemoteImageHtml(imagesResult.Images[i], imageType);
    }

    const availableImagesList = page.querySelector('.availableImagesList') as HTMLElement;
    availableImagesList.innerHTML = html;
    imageLoader.lazyChildren(availableImagesList);

    const btnNextPage = page.querySelector('.btnNextPage') as HTMLElement;
    const btnPreviousPage = page.querySelector('.btnPreviousPage') as HTMLElement;

    if (btnNextPage) {
        btnNextPage.addEventListener('click', function () {
            browsableImageStartIndex += browsableImagePageSize;
            reloadBrowsableImages(page, apiClient);
        });
    }

    if (btnPreviousPage) {
        btnPreviousPage.addEventListener('click', function () {
            browsableImageStartIndex -= browsableImagePageSize;
            reloadBrowsableImages(page, apiClient);
        });
    }
}

function getPagingHtml(startIndex: number, limit: number, totalRecordCount: number): string {
    let html = '';

    const recordsEnd = Math.min(startIndex + limit, totalRecordCount);

    // 20 is the minimum page size
    const showControls = totalRecordCount > limit;

    html += '<div class="listPaging">';

    html += '<span style="margin-right: 10px;">';

    const startAtDisplay = totalRecordCount ? startIndex + 1 : 0;
    html += globalize.translate('ListPaging', String(startAtDisplay), String(recordsEnd), String(totalRecordCount));

    html += '</span>';

    if (showControls) {
        html += '<div data-role="controlgroup" data-type="horizontal" style="display:inline-block;">';

        html += `<button is="paper-icon-button-light" title="${globalize.translate('Previous')}" class="btnPreviousPage autoSize" ${(startIndex ? '' : 'disabled')}><span class="material-icons arrow_back" aria-hidden="true"></span></button>`;
        html += `<button is="paper-icon-button-light" title="${globalize.translate('Next')}" class="btnNextPage autoSize" ${(startIndex + limit >= totalRecordCount ? 'disabled' : '')}><span class="material-icons arrow_forward" aria-hidden="true"></span></button>`;
        html += '</div>';
    }

    html += '</div>';

    return html;
}

function downloadRemoteImage(page: HTMLElement, apiClient: any, url: string, type: string, provider: string): void {
    const options = getBaseRemoteOptions(page, true);

    options.Type = type;
    options.ImageUrl = url;
    options.ProviderName = provider;

    loading.show();

    apiClient.downloadRemoteImage(options).then(function () {
        hasChanges = true;
        const dlg = dom.parentWithClass(page, 'dialog') as HTMLElement;
        dialogHelper.close(dlg);
    });
}

interface RemoteImage {
    ProviderName: string;
    Url: string;
    Type: string;
    Width?: number;
    Height?: number;
    Language?: string;
    CommunityRating?: number | null;
    RatingType?: string;
    VoteCount?: number;
}

function getRemoteImageHtml(image: RemoteImage, imageType: string): string {
    const tagName = layoutManager.tv ? 'button' : 'div';
    const enableFooterButtons = !layoutManager.tv;

    let html = '';

    let cssClass = 'card scalableCard imageEditorCard';
    const cardBoxCssClass = 'cardBox visualCardBox';

    let shape: string;
    if (imageType === 'Backdrop' || imageType === 'Art' || imageType === 'Thumb' || imageType === 'Logo') {
        shape = 'backdrop';
    } else if (imageType === 'Banner') {
        shape = 'banner';
    } else if (imageType === 'Disc') {
        shape = 'square';
    } else if (currentItemType === 'Episode') {
        shape = 'backdrop';
    } else if (currentItemType === 'MusicAlbum' || currentItemType === 'MusicArtist') {
        shape = 'square';
    } else {
        shape = 'portrait';
    }

    cssClass += ' ' + shape + 'Card ' + shape + 'Card-scalable';
    if (tagName === 'button') {
        cssClass += ' btnImageCard';

        if (layoutManager.tv) {
            cssClass += ' show-focus';

            if (enableFocusTransform) {
                cssClass += ' show-animation';
            }
        }

        html += '<button type="button" class="' + cssClass + '"';
    } else {
        html += '<div class="' + cssClass + '"';
    }

    html += ' data-imageprovider="' + image.ProviderName + '" data-imageurl="' + image.Url + '" data-imagetype="' + image.Type + '"';

    html += '>';

    html += '<div class="' + cardBoxCssClass + '">';
    html += '<div class="cardScalable visualCardBox-cardScalable" style="background-color:transparent;">';
    html += '<div class="cardPadder-' + shape + '"></div>';
    html += '<div class="cardContent">';

    if (layoutManager.tv || !appHost.supports(AppFeature.ExternalLinks)) {
        html += '<div class="cardImageContainer lazy" data-src="' + image.Url + '" style="background-position:center center;background-size:contain;"></div>';
    } else {
        html += '<a is="emby-linkbutton" target="_blank" href="' + image.Url + '" class="button-link cardImageContainer lazy" data-src="' + image.Url + '" style="background-position:center center;background-size:contain"></a>';
    }

    html += '</div>';
    html += '</div>';

    // begin footer
    html += '<div class="cardFooter visualCardBox-cardFooter">';

    html += '<div class="cardText cardTextCentered">' + image.ProviderName + '</div>';

    if (image.Width || image.Height || image.Language) {
        html += '<div class="cardText cardText-secondary cardTextCentered">';

        if (image.Width && image.Height) {
            html += image.Width + ' x ' + image.Height;

            if (image.Language) {
                html += ' \u2022 ' + image.Language;
            }
        } else if (image.Language) {
            html += image.Language;
        }

        html += '</div>';
    }

    if (image.CommunityRating != null) {
        html += '<div class="cardText cardText-secondary cardTextCentered">';

        if (image.RatingType === 'Likes') {
            html += image.CommunityRating + (image.CommunityRating === 1 ? ' like' : ' likes');
        } else if (image.CommunityRating) {
            html += (image.CommunityRating as number).toFixed(1);

            if (image.VoteCount) {
                html += ' \u2022 ' + image.VoteCount + (image.VoteCount === 1 ? ' vote' : ' votes');
            }
        } else {
            html += 'Unrated';
        }

        html += '</div>';
    }

    if (enableFooterButtons) {
        html += '<div class="cardText cardTextCentered">';

        html += `<button is="paper-icon-button-light" class="btnDownloadRemoteImage autoSize" raised" title="${globalize.translate('Download')}"><span class="material-icons cloud_download" aria-hidden="true"></span></button>`;
        html += '</div>';
    }

    html += '</div>';
    // end footer

    html += '</div>';

    html += '</' + tagName + '>';

    return html;
}

function reloadBrowsableImagesFirstPage(page: HTMLElement, apiClient: any): void {
    browsableImageStartIndex = 0;
    reloadBrowsableImages(page, apiClient);
}

function initEditor(page: HTMLElement, apiClient: any): void {
    (page.querySelector('#selectBrowsableImageType') as HTMLSelectElement).addEventListener('change', function (this: HTMLSelectElement) {
        browsableImageType = this.value;
        selectedProvider = null;

        reloadBrowsableImagesFirstPage(page, apiClient);
    });

    (page.querySelector('#selectImageProvider') as HTMLSelectElement).addEventListener('change', function (this: HTMLSelectElement) {
        selectedProvider = this.value;

        reloadBrowsableImagesFirstPage(page, apiClient);
    });

    (page.querySelector('#chkAllLanguages') as HTMLInputElement).addEventListener('change', function () {
        reloadBrowsableImagesFirstPage(page, apiClient);
    });

    (page.querySelector('#chkShowParentImages') as HTMLInputElement).addEventListener('change', function () {
        reloadBrowsableImagesFirstPage(page, apiClient);
    });

    page.addEventListener('click', function (e: Event) {
        const target = e.target as HTMLElement;
        const btnDownloadRemoteImage = dom.parentWithClass(target, 'btnDownloadRemoteImage');
        if (btnDownloadRemoteImage) {
            const card = dom.parentWithClass(btnDownloadRemoteImage, 'card') as HTMLElement;
            downloadRemoteImage(page, apiClient, card.getAttribute('data-imageurl')!, card.getAttribute('data-imagetype')!, card.getAttribute('data-imageprovider')!);
            return;
        }

        const btnImageCard = dom.parentWithClass(target, 'btnImageCard');
        if (btnImageCard) {
            downloadRemoteImage(page, apiClient, btnImageCard.getAttribute('data-imageurl')!, btnImageCard.getAttribute('data-imagetype')!, btnImageCard.getAttribute('data-imageprovider')!);
        }
    });
}

function showEditor(itemId: string, serverId: string, itemType: string): void {
    loading.show();

    const apiClient = ServerConnections.getApiClient(serverId);

    currentItemId = itemId;
    currentItemType = itemType;

    const dialogOptions: any = {
        removeOnClose: true
    };

    if (layoutManager.tv) {
        dialogOptions.size = 'fullscreen';
    } else {
        dialogOptions.size = 'small';
    }

    const dlg = dialogHelper.createDialog(dialogOptions);

    dlg.innerHTML = globalize.translateHtml(template, 'core');

    if (layoutManager.tv) {
        scrollHelper.centerFocus.on(dlg, false);
    }

    if (browsableParentId) {
        (dlg.querySelector('#lblShowParentImages') as HTMLElement).classList.remove('hide');
    }

    // Has to be assigned a z-index after the call to .open()
    dlg.addEventListener('close', onDialogClosed);

    dialogHelper.open(dlg);

    const editorContent = dlg.querySelector('.formDialogContent') as HTMLElement;
    initEditor(editorContent, apiClient);

    dlg.querySelector('.btnCancel')!.addEventListener('click', function () {
        dialogHelper.close(dlg);
    });

    reloadBrowsableImages(editorContent, apiClient);
}

function onDialogClosed(this: HTMLElement): void {
    const dlg = this;

    if (layoutManager.tv) {
        scrollHelper.centerFocus.off(dlg, false);
    }

    loading.hide();
    if (hasChanges) {
        currentResolve();
    } else {
        currentReject();
    }
}

export function show(itemId: string, serverId: string, itemType: string, imageType?: string, parentId?: string): Promise<void> {
    return new Promise(function (resolve, reject) {
        currentResolve = resolve;
        currentReject = reject;
        hasChanges = false;
        browsableImageStartIndex = 0;
        browsableImageType = imageType || 'Primary';
        selectedProvider = null;
        browsableParentId = parentId || '';
        showEditor(itemId, serverId, itemType);
    });
}

export default {
    show: show
};
