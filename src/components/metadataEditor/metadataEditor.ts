import escapeHtml from 'escape-html';
import dom from '../../utils/dom';
import layoutManager from '../layoutManager';
import dialogHelper from '../dialogHelper/dialogHelper';
import datetime from '../../scripts/datetime';
import loading from '../loading/loading';
import focusManager from '../focusManager';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-select/emby-select';
import '../listview/listview.scss';
import '../../elements/emby-textarea/emby-textarea';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-button/paper-icon-button-light';
import '../formdialog.scss';
import '../../styles/clearbutton.scss';
import '../../styles/flexstyles.scss';
import './style.scss';
import toast from '../toast/toast';
import { appRouter } from '../router/appRouter';
import template from './metadataEditor.template.html';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { SeriesStatus } from '@jellyfin/sdk/lib/generated-client/models/series-status';

interface MetadataEditorInfo {
    ContentType?: string;
    ContentTypeOptions?: Array<{ Name: string; Value: string }>;
    Cultures?: Array<{ Name: string; DisplayName: string }>;
    Countries?: Array<{ TwoLetterISORegionName: string; DisplayName: string }>;
    ExternalIdInfos?: ExternalIdInfo[];
    ParentalRatingOptions?: ParentalRating[];
    [key: string]: unknown;
}

interface ExternalIdInfo {
    Key: string;
    Name: string;
    Type?: string;
    [key: string]: unknown;
}

interface ParentalRating {
    Name: string;
    Value?: string;
    [key: string]: unknown;
}

interface Item {
    Id?: string;
    Name?: string;
    OriginalTitle?: string;
    OriginalLanguage?: string;
    ForcedSortName?: string;
    CommunityRating?: string;
    CriticRating?: string;
    IndexNumber?: number | string | null;
    ParentIndexNumber?: number | string | null;
    DisplayOrder?: string;
    Album?: string;
    AlbumArtists?: Array<{ Name?: string }>;
    ArtistItems?: Array<{ Name?: string }>;
    Overview?: string;
    Status?: string;
    AirDays?: string[];
    AirTime?: string;
    Genres?: string[];
    Tags?: string[];
    Studios?: Array<{ Name?: string }>;
    PremiereDate?: string;
    DateCreated?: string;
    EndDate?: string;
    ProductionYear?: string | number;
    Height?: string;
    AspectRatio?: string;
    Video3DFormat?: string;
    OfficialRating?: string;
    CustomRating?: string;
    People?: Person[];
    LockData?: boolean;
    LockedFields?: string[];
    ProviderIds?: Record<string, string>;
    PreferredMetadataLanguage?: string;
    PreferredMetadataCountryCode?: string;
    ProductionLocations?: string[];
    RunTimeTicks?: number | null;
    Taglines?: string[];
    Path?: string;
    EnableMediaSourceDisplay?: boolean;
    Type?: string;
    MediaType?: string;
    ServerId?: string;
    SeasonId?: string;
    SeriesId?: string;
    ParentId?: string;
    AirsBeforeSeasonNumber?: string;
    AirsAfterSeasonNumber?: string;
    AirsBeforeEpisodeNumber?: string;
    [key: string]: unknown;
}

interface Person {
    Name?: string;
    Type?: string;
    Role?: string;
    [key: string]: unknown;
}

interface LockedField {
    name: string;
    value?: string;
}

interface EditorConfig {
    ContentType?: string;
    ContentTypeOptions?: Array<{ Name: string; Value: string }>;
    Cultures?: Array<{ Name: string; DisplayName: string }>;
    Countries?: Array<{ TwoLetterISORegionName: string; DisplayName: string }>;
    ExternalIdInfos?: ExternalIdInfo[];
    ParentalRatingOptions?: ParentalRating[];
    [key: string]: unknown;
}

let currentContext: HTMLElement | null;
let metadataEditorInfo: MetadataEditorInfo;
let currentItem: Item;

function isDialog(): boolean {
    return currentContext!.classList.contains('dialog');
}

function closeDialog(): void {
    if (isDialog()) {
        dialogHelper.close(currentContext!);
    }
}

function submitUpdatedItem(form: HTMLFormElement, item: Item): void {
    function afterContentTypeUpdated(): void {
        toast(globalize.translate('MessageItemSaved'));

        loading.hide();
        closeDialog();
    }

    const apiClient = getApiClient();

    apiClient.updateItem(item).then(function () {
        const newContentType = (form.querySelector('#selectContentType') as HTMLSelectElement).value || '';

        if ((metadataEditorInfo.ContentType || '') !== newContentType) {
            apiClient.ajax({

                url: apiClient.getUrl('Items/' + item.Id + '/ContentType', {
                    ContentType: newContentType
                }),

                type: 'POST'

            }).then(function () {
                afterContentTypeUpdated();
            });
        } else {
            afterContentTypeUpdated();
        }
    });
}

function getSelectedAirDays(form: HTMLFormElement): string[] {
    const checkedItems = form.querySelectorAll('.chkAirDay:checked') || [];
    return Array.prototype.map.call(checkedItems, function (c: HTMLInputElement) {
        return c.getAttribute('data-day') || '';
    }) as string[];
}

function getAlbumArtists(form: HTMLFormElement): Array<{ Name: string }> {
    return (form.querySelector('#txtArtist') as HTMLInputElement).value.trim().split(';').filter(function (s) {
        return s.length > 0;
    }).map(function (a) {
        return {
            Name: a
        };
    });
}

function getArtists(form: HTMLFormElement): Array<{ Name: string }> {
    return (form.querySelector('#txtArtist') as HTMLInputElement).value.trim().split(';').filter(function (s) {
        return s.length > 0;
    }).map(function (a) {
        return {
            Name: a
        };
    });
}

function getDateValue(form: HTMLFormElement, element: string, property: keyof Item): string | null {
    let val = (form.querySelector(element) as HTMLInputElement).value;

    if (!val) {
        return null;
    }

    if (currentItem[property]) {
        const date = datetime.parseISO8601Date(currentItem[property] as string, true);

        const parts = date.toISOString().split('T');

        // If the date is the same, preserve the time
        if (parts[0].startsWith(val)) {
            const iso = parts[1];

            val += 'T' + iso;
        }
    }

    return val;
}

function onSubmit(this: any, e: Event): void {
    loading.show();

    const form = this as HTMLFormElement;

    const item: Item = {
        Id: currentItem.Id,
        Name: (form.querySelector('#txtName') as HTMLInputElement).value,
        OriginalTitle: (form.querySelector('#txtOriginalName') as HTMLInputElement).value,
        OriginalLanguage: (form.querySelector('#selectOriginalLanguage') as HTMLSelectElement).value,
        ForcedSortName: (form.querySelector('#txtSortName') as HTMLInputElement).value,
        CommunityRating: (form.querySelector('#txtCommunityRating') as HTMLInputElement).value,
        CriticRating: (form.querySelector('#txtCriticRating') as HTMLInputElement).value,
        IndexNumber: (form.querySelector('#txtIndexNumber') as HTMLInputElement).value || null,
        AirsBeforeSeasonNumber: (form.querySelector('#txtAirsBeforeSeason') as HTMLInputElement).value,
        AirsAfterSeasonNumber: (form.querySelector('#txtAirsAfterSeason') as HTMLInputElement).value,
        AirsBeforeEpisodeNumber: (form.querySelector('#txtAirsBeforeEpisode') as HTMLInputElement).value,
        ParentIndexNumber: (form.querySelector('#txtParentIndexNumber') as HTMLInputElement).value || null,
        DisplayOrder: (form.querySelector('#selectDisplayOrder') as HTMLSelectElement).value,
        Album: (form.querySelector('#txtAlbum') as HTMLInputElement).value,
        AlbumArtists: getAlbumArtists(form),
        ArtistItems: getArtists(form),
        Overview: (form.querySelector('#txtOverview') as HTMLTextAreaElement).value,
        Status: (form.querySelector('#selectStatus') as HTMLSelectElement).value,
        AirDays: getSelectedAirDays(form),
        AirTime: (form.querySelector('#txtAirTime') as HTMLInputElement).value,
        Genres: getListValues(form.querySelector('#listGenres')!),
        Tags: getListValues(form.querySelector('#listTags')!),
        Studios: getListValues(form.querySelector('#listStudios')!).map(function (element) {
            return { Name: element };
        }),

        PremiereDate: getDateValue(form, '#txtPremiereDate', 'PremiereDate') ?? undefined,
        DateCreated: getDateValue(form, '#txtDateAdded', 'DateCreated') ?? undefined,
        EndDate: getDateValue(form, '#txtEndDate', 'EndDate') ?? undefined,
        ProductionYear: (form.querySelector('#txtProductionYear') as HTMLInputElement).value,
        Height: (form.querySelector('#selectHeight') as HTMLSelectElement).value,
        AspectRatio: (form.querySelector('#txtOriginalAspectRatio') as HTMLInputElement).value,
        Video3DFormat: (form.querySelector('#select3dFormat') as HTMLSelectElement).value,

        OfficialRating: (form.querySelector('#selectOfficialRating') as HTMLSelectElement).value,
        CustomRating: (form.querySelector('#selectCustomRating') as HTMLSelectElement).value,
        People: currentItem.People,
        LockData: (form.querySelector('#chkLockData') as HTMLInputElement).checked,
        LockedFields: Array.prototype.filter.call(form.querySelectorAll('.selectLockedField'), function (c: HTMLInputElement) {
            return !c.checked;
        }).map(function (c: HTMLInputElement) {
            return c.getAttribute('data-value') || '';
        })
    };

    item.ProviderIds = { ...currentItem.ProviderIds };

    const idElements = form.querySelectorAll('.txtExternalId');
    Array.prototype.map.call(idElements, function (idElem: HTMLInputElement) {
        const providerKey = idElem.getAttribute('data-providerkey') || '';
        item.ProviderIds![providerKey] = idElem.value;
    });

    item.PreferredMetadataLanguage = (form.querySelector('#selectLanguage') as HTMLSelectElement).value;
    item.PreferredMetadataCountryCode = (form.querySelector('#selectCountry') as HTMLSelectElement).value;

    if (currentItem.Type === 'Person') {
        const placeOfBirth = (form.querySelector('#txtPlaceOfBirth') as HTMLInputElement).value;

        item.ProductionLocations = placeOfBirth ? [placeOfBirth] : [];
    }

    if (currentItem.Type === 'Series') {
        // 600000000
        const seriesRuntime = (form.querySelector('#txtSeriesRuntime') as HTMLInputElement).value;
        item.RunTimeTicks = seriesRuntime ? (parseInt(seriesRuntime) * 600000000) : null;
    }

    const tagline = (form.querySelector('#txtTagline') as HTMLInputElement).value;
    item.Taglines = tagline ? [tagline] : [];

    submitUpdatedItem(form, item);

    e.preventDefault();
    e.stopPropagation();

    // Disable default form submission
    return;
}

function getListValues(list: HTMLElement): string[] {
    return Array.prototype.map.call(list.querySelectorAll('.textValue'), function (el: HTMLElement) {
        return el.textContent || '';
    }) as string[];
}

function addElementToList(source: HTMLElement, sortCallback?: (items: string[]) => string[]): void {
    import('../prompt/prompt').then(({ default: prompt }) => {
        prompt({
            label: 'Value:'
        }).then(function (text: string) {
            const list = dom.parentWithClass(source, 'editableListviewContainer')?.querySelector('.paperList')! as HTMLElement;
            const items = getListValues(list);
            items.push(text);
            populateListView(list as HTMLElement, items, sortCallback);
        });
    });
}

function removeElementFromList(source: HTMLElement): void {
    const el = dom.parentWithClass(source, 'listItem')!;
    el.parentNode?.removeChild(el);
}

function editPerson(context: HTMLElement, person: Person, index: number): void {
    import('./personEditor').then(({ default: personEditor }) => {
        personEditor.show(person).then(function (updatedPerson: Person) {
            const isNew = index === -1;

            if (isNew) {
                currentItem.People!.push(updatedPerson);
            }

            populatePeople(context, currentItem.People || []);
        });
    });
}

function afterDeleted(context: HTMLElement, item: Item): void {
    const parentId = item.ParentId || item.SeasonId || item.SeriesId;

    if (parentId) {
        reload(context, parentId, item.ServerId!);
    } else {
        appRouter.goHome();
    }
}

function showMoreMenu(context: HTMLElement, button: HTMLElement, user: unknown): void {
    import('../itemContextMenu').then(({ default: itemContextMenu }) => {
        const item = currentItem;

        itemContextMenu.show({
            item: item,
            positionTo: button,
            edit: false,
            editImages: true,
            editSubtitles: true,
            share: false,
            play: false,
            queue: false,
            user: user
        }).then(function (result: { deleted?: boolean; updated?: boolean }) {
            if (result.deleted) {
                afterDeleted(context, item);
            } else if (result.updated) {
                reload(context, item.Id!, item.ServerId!);
            }
        }).catch(() => { /* no-op */ });
    });
}

function onEditorClick(e: Event): void {
    const target = (e as MouseEvent).target as HTMLElement;
    const btnRemoveFromEditorList = dom.parentWithClass(target, 'btnRemoveFromEditorList');
    if (btnRemoveFromEditorList) {
        removeElementFromList(btnRemoveFromEditorList);
        return;
    }

    const btnAddTextItem = dom.parentWithClass(target, 'btnAddTextItem');
    if (btnAddTextItem) {
        addElementToList(btnAddTextItem);
    }
}

function getApiClient(): any {
    return ServerConnections.getApiClient(currentItem.ServerId!);
}

function bindAll(elems: NodeListOf<Element>, eventName: string, fn: EventListener): void {
    for (let i = 0, length = elems.length; i < length; i++) {
        elems[i].addEventListener(eventName, fn);
    }
}

function onResetClick(): void {
    const resetElementId = ['#txtName', '#txtOriginalName', '#selectOriginalLanguage', '#txtSortName', '#txtCommunityRating', '#txtCriticRating',
        '#txtIndexNumber', '#txtAirsBeforeSeason', '#txtAirsAfterSeason', '#txtAirsBeforeEpisode', '#txtParentIndexNumber', '#txtAlbum',
        '#txtAlbumArtist', '#txtArtist', '#txtOverview', '#selectStatus', '#txtAirTime', '#txtPremiereDate', '#txtDateAdded', '#txtEndDate',
        '#txtProductionYear', '#selectHeight', '#txtOriginalAspectRatio', '#select3dFormat', '#selectOfficialRating', '#selectCustomRating',
        '#txtSeriesRuntime', '#txtTagline'];
    const form = currentContext?.querySelector('form') as HTMLFormElement;
    resetElementId.forEach(function (id) {
        (form.querySelector(id) as HTMLInputElement).value = '';
    });
    (form.querySelector('#selectDisplayOrder') as HTMLSelectElement).value = '';
    (form.querySelector('#selectLanguage') as HTMLSelectElement).value = '';
    (form.querySelector('#selectCountry') as HTMLSelectElement).value = '';
    form.querySelector('#listGenres')!.innerHTML = '';
    form.querySelector('#listTags')!.innerHTML = '';
    form.querySelector('#listStudios')!.innerHTML = '';
    form.querySelector('#peopleList')!.innerHTML = '';
    currentItem.People = [];

    const checkedItems = form.querySelectorAll('.chkAirDay:checked') || [];
    checkedItems.forEach(function (checkbox) {
        (checkbox as HTMLInputElement).checked = false;
    });

    const idElements = form.querySelectorAll('.txtExternalId');
    idElements.forEach(function (idElem) {
        (idElem as HTMLInputElement).value = '';
    });

    (form.querySelector('#chkLockData') as HTMLInputElement).checked = false;
    showElement('.providerSettingsContainer');

    const lockedFields = form.querySelectorAll('.selectLockedField');
    lockedFields.forEach(function (checkbox) {
        (checkbox as HTMLInputElement).checked = true;
    });
}

function init(context: HTMLElement): void {
    if (!layoutManager.desktop) {
        context.querySelector('.btnBack')?.classList.remove('hide');
        context.querySelector('.btnClose')?.classList.add('hide');
    }

    bindAll(context.querySelectorAll('.btnCancel'), 'click', function (event: Event) {
        event.preventDefault();
        closeDialog();
    });

    context.querySelector('.btnMore')?.addEventListener('click', function (e: Event) {
        getApiClient().getCurrentUser().then(function (user: unknown) {
            showMoreMenu(context, (e as MouseEvent).target as HTMLElement, user);
        });
    });

    context.querySelector('.btnHeaderSave')?.addEventListener('click', function () {
        (context.querySelector('.btnSave') as HTMLElement).click();
    });

    context.querySelector('#chkLockData')?.addEventListener('click', function (e: Event) {
        if (!(e.target as HTMLInputElement).checked) {
            showElement('.providerSettingsContainer');
        } else {
            hideElement('.providerSettingsContainer');
        }
    });

    context.removeEventListener('click', onEditorClick);
    context.addEventListener('click', onEditorClick);

    const form = context.querySelector('form')!;
    form.removeEventListener('submit', onSubmit);
    form.addEventListener('submit', onSubmit);

    context.querySelector('.btnReset')?.addEventListener('click', onResetClick);

    context.querySelector('#btnAddPerson')?.addEventListener('click', function () {
        editPerson(context, {}, -1);
    });

    context.querySelector('#peopleList')?.addEventListener('click', function (e: Event) {
        let index: number;
        const target = (e as MouseEvent).target as HTMLElement;
        const btnDeletePerson = dom.parentWithClass(target, 'btnDeletePerson');
        if (btnDeletePerson) {
            index = parseInt(btnDeletePerson.getAttribute('data-index')!, 10);
            currentItem.People!.splice(index, 1);
            populatePeople(context, currentItem.People || []);
        }

        const btnEditPerson = dom.parentWithClass(target, 'btnEditPerson');
        if (btnEditPerson) {
            index = parseInt(btnEditPerson.getAttribute('data-index')!, 10);
            editPerson(context, currentItem.People![index], index);
        }
    });
}

function getItem(itemId: string | null, serverId: string): Promise<Item> {
    const apiClient = ServerConnections.getApiClient(serverId) as any;

    if (itemId) {
        return apiClient.getItem(apiClient.getCurrentUserId(), itemId);
    }

    return apiClient.getRootFolder(apiClient.getCurrentUserId());
}

function getEditorConfig(itemId: string | null, serverId: string): Promise<EditorConfig> {
    const apiClient = ServerConnections.getApiClient(serverId) as any;

    if (itemId) {
        return apiClient.getJSON(apiClient.getUrl('Items/' + itemId + '/MetadataEditor'));
    }

    return Promise.resolve({} as EditorConfig);
}

function populateCountries(select: HTMLSelectElement, allCountries: Array<{ TwoLetterISORegionName: string; DisplayName: string }>): void {
    let html = '';

    html += "<option value=''></option>";

    for (let i = 0, length = allCountries.length; i < length; i++) {
        const culture = allCountries[i];

        html += "<option value='" + culture.TwoLetterISORegionName + "'>" + culture.DisplayName + '</option>';
    }

    select.innerHTML = html;
}

function populateLanguages(select: HTMLSelectElement, languages: Array<{ Name: string; DisplayName: string }>): void {
    let html = '';

    html += "<option value=''></option>";

    for (let i = 0, length = languages.length; i < length; i++) {
        const culture = languages[i];

        html += "<option value='" + culture.Name + "' data-culture-name='" + culture.Name + "'>" + culture.DisplayName + '</option>';
    }

    select.innerHTML = html;
}

function syncMetadataLanguageFromCountry(context: HTMLElement): void {
    const selectCountry = context.querySelector('#selectCountry') as HTMLSelectElement | null;
    const selectLanguage = context.querySelector('#selectLanguage') as HTMLSelectElement | null;

    if (!selectCountry || !selectLanguage) {
        return;
    }

    const countryCode = selectCountry.value || '';
    if (!countryCode) {
        return;
    }

    if (selectLanguage.value) {
        return;
    }

    if (countryCode.toUpperCase() === 'BR') {
        const preferredOption = selectLanguage.querySelector("option[data-culture-name='pt-BR']") as HTMLOptionElement | null;
        if (preferredOption) {
            selectLanguage.value = preferredOption.value;
            return;
        }
    }
}

function renderContentTypeOptions(context: HTMLElement, metadataInfo: MetadataEditorInfo): void {
    if (!metadataInfo.ContentTypeOptions?.length) {
        hideElement('#fldContentType', context);
    } else {
        showElement('#fldContentType', context);
    }

    const html = (metadataInfo.ContentTypeOptions || []).map(function (i) {
        return '<option value="' + i.Value + '">' + i.Name + '</option>';
    }).join('');

    const selectEl = context.querySelector('#selectContentType') as HTMLSelectElement;
    selectEl.innerHTML = html;
    selectEl.value = metadataInfo.ContentType || '';
}

function loadExternalIds(context: HTMLElement, item: Item, externalIds: ExternalIdInfo[]): void {
    let html = '';

    const providerIds = item.ProviderIds || {};

    for (let i = 0, length = externalIds.length; i < length; i++) {
        const idInfo = externalIds[i];

        const id = 'txt1' + idInfo.Key;

        let fullName = idInfo.Name;
        if (idInfo.Type) {
            fullName = idInfo.Name + ' ' + globalize.translate(idInfo.Type);
        }

        const labelText = globalize.translate('LabelDynamicExternalId', escapeHtml(fullName));

        html += '<div class="inputContainer">';
        html += '<div class="flex align-items-center">';

        const value = escapeHtml(providerIds[idInfo.Key] || '');

        html += '<div class="flex-grow">';
        html += '<input is="emby-input" class="txtExternalId" value="' + value + '" data-providerkey="' + idInfo.Key + '" id="' + id + '" label="' + labelText + '"/>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }

    const elem = context.querySelector('.externalIds');
    if (elem) {
        elem.innerHTML = html;
    }

    if (externalIds.length) {
        context.querySelector('.externalIdsSection')?.classList.remove('hide');
    } else {
        context.querySelector('.externalIdsSection')?.classList.add('hide');
    }
}

// Function to hide the element by selector or raw element
// Selector can be an element or a selector string
// Context is optional and restricts the querySelector to the context
function hideElement(selector: string | HTMLElement, context?: HTMLElement, multiple?: boolean): void {
    const ctx = context || document;
    if (typeof selector === 'string') {
        const elements = multiple ? ctx.querySelectorAll(selector) : [ctx.querySelector(selector)];

        Array.prototype.forEach.call(elements, function (el: Element | null) {
            if (el) {
                el.classList.add('hide');
            }
        });
    } else {
        selector.classList.add('hide');
    }
}

// Function to show the element by selector or raw element
// Selector can be an element or a selector string
// Context is optional and restricts the querySelector to the context
function showElement(selector: string | HTMLElement, context?: HTMLElement, multiple?: boolean): void {
    const ctx = context || document;
    if (typeof selector === 'string') {
        const elements = multiple ? ctx.querySelectorAll(selector) : [ctx.querySelector(selector)];

        Array.prototype.forEach.call(elements, function (el: Element | null) {
            if (el) {
                el.classList.remove('hide');
            }
        });
    } else {
        selector.classList.remove('hide');
    }
}

function setFieldVisibilities(context: HTMLElement, item: Item): void {
    if (item.Path && item.EnableMediaSourceDisplay !== false) {
        showElement('#fldPath', context);
    } else {
        hideElement('#fldPath', context);
    }

    if ([BaseItemKind.Series, BaseItemKind.Season, BaseItemKind.Episode, BaseItemKind.Movie, BaseItemKind.Trailer, BaseItemKind.Person].includes(item.Type as BaseItemKind as string as any)) {
        showElement('#fldOriginalName', context);
    } else {
        hideElement('#fldOriginalName', context);
    }

    if (item.Type === 'Series' || item.MediaType === 'Video') {
        showElement('#fldOriginalLanguage', context);
    } else {
        hideElement('#fldOriginalLanguage', context);
    }

    if (item.Type === 'Series') {
        showElement('#fldSeriesRuntime', context);
    } else {
        hideElement('#fldSeriesRuntime', context);
    }

    if (item.Type === 'Series' || item.Type === 'Person') {
        showElement('#fldEndDate', context);
    } else {
        hideElement('#fldEndDate', context);
    }

    if (item.Type === 'MusicAlbum') {
        showElement('#albumAssociationMessage', context);
    } else {
        hideElement('#albumAssociationMessage', context);
    }

    if (item.Type === 'Movie' || item.Type === 'Trailer') {
        showElement('#fldCriticRating', context);
    } else {
        hideElement('#fldCriticRating', context);
    }

    if (item.Type === 'Series') {
        showElement('#fldStatus', context);
        showElement('#fldAirDays', context);
        showElement('#fldAirTime', context);
    } else {
        hideElement('#fldStatus', context);
        hideElement('#fldAirDays', context);
        hideElement('#fldAirTime', context);
    }

    if (item.MediaType === 'Video' && item.Type !== 'TvChannel') {
        showElement('#fld3dFormat', context);
    } else {
        hideElement('#fld3dFormat', context);
    }

    if (item.Type === BaseItemKind.Audio || item.Type === BaseItemKind.MusicAlbum || item.Type === BaseItemKind.MusicVideo) {
        showElement('#fldArtist', context);
        showElement('#fldAlbumArtist', context);
    } else {
        hideElement('#fldArtist', context);
        hideElement('#fldAlbumArtist', context);
    }

    if (item.Type === BaseItemKind.Audio || item.Type === BaseItemKind.MusicVideo) {
        showElement('#fldAlbum', context);
    } else {
        hideElement('#fldAlbum', context);
    }

    if (item.Type === 'Episode' && item.ParentIndexNumber === 0) {
        showElement('#collapsibleSpecialEpisodeInfo', context);
    } else {
        hideElement('#collapsibleSpecialEpisodeInfo', context);
    }

    if (item.Type === 'Person'
            || item.Type === 'Genre'
            || item.Type === 'Studio'
            || item.Type === 'MusicGenre'
            || item.Type === 'TvChannel') {
        hideElement('#peopleCollapsible', context);
    } else {
        showElement('#peopleCollapsible', context);
    }

    if (item.Type === 'Person' || item.Type === 'Genre' || item.Type === 'Studio' || item.Type === 'MusicGenre' || item.Type === 'TvChannel') {
        hideElement('#fldCommunityRating', context);
        hideElement('#genresCollapsible', context);
        hideElement('#studiosCollapsible', context);

        if (item.Type === 'TvChannel') {
            showElement('#fldOfficialRating', context);
        } else {
            hideElement('#fldOfficialRating', context);
        }
        hideElement('#fldCustomRating', context);
    } else {
        showElement('#fldCommunityRating', context);
        showElement('#genresCollapsible', context);
        showElement('#studiosCollapsible', context);
        showElement('#fldOfficialRating', context);
        showElement('#fldCustomRating', context);
    }

    showElement('#tagsCollapsible', context);

    if (item.Type === 'TvChannel') {
        hideElement('#metadataSettingsCollapsible', context);
        hideElement('#fldPremiereDate', context);
        hideElement('#fldDateAdded', context);
        hideElement('#fldYear', context);
    } else {
        showElement('#metadataSettingsCollapsible', context);
        showElement('#fldPremiereDate', context);
        showElement('#fldDateAdded', context);
        showElement('#fldYear', context);
    }

    if (item.Type === 'TvChannel') {
        hideElement('.overviewContainer', context);
    } else {
        showElement('.overviewContainer', context);
    }

    if (item.Type === 'Person') {
        (context.querySelector('#txtName') as any).label(globalize.translate('LabelName'));
        (context.querySelector('#txtSortName') as any).label(globalize.translate('LabelSortName'));
        (context.querySelector('#txtOriginalName') as any).label(globalize.translate('LabelOriginalName'));
        (context.querySelector('#txtProductionYear') as any).label(globalize.translate('LabelBirthYear'));
        (context.querySelector('#txtPremiereDate') as any).label(globalize.translate('LabelBirthDate'));
        (context.querySelector('#txtEndDate') as any).label(globalize.translate('LabelDeathDate'));
        showElement('#fldPlaceOfBirth');
    } else {
        (context.querySelector('#txtProductionYear') as any).label(globalize.translate('LabelYear'));
        (context.querySelector('#txtPremiereDate') as any).label(globalize.translate('LabelReleaseDate'));
        (context.querySelector('#txtEndDate') as any).label(globalize.translate('LabelEndDate'));
        hideElement('#fldPlaceOfBirth');
    }

    if (item.MediaType === 'Video' && item.Type === 'TvChannel') {
        showElement('#fldHeight');
    } else {
        hideElement('#fldHeight');
    }

    if (item.MediaType === 'Video' && item.Type !== 'TvChannel') {
        showElement('#fldOriginalAspectRatio');
    } else {
        hideElement('#fldOriginalAspectRatio');
    }

    if (item.Type === 'Audio' || item.Type === 'Episode' || item.Type === 'Season') {
        showElement('#fldIndexNumber');

        if (item.Type === 'Episode') {
            (context.querySelector('#txtIndexNumber') as any).label(globalize.translate('LabelEpisodeNumber'));
        } else if (item.Type === 'Season') {
            (context.querySelector('#txtIndexNumber') as any).label(globalize.translate('LabelSeasonNumber'));
        } else if (item.Type === 'Audio') {
            (context.querySelector('#txtIndexNumber') as any).label(globalize.translate('LabelTrackNumber'));
        } else {
            (context.querySelector('#txtIndexNumber') as any).label(globalize.translate('LabelNumber'));
        }
    } else {
        hideElement('#fldIndexNumber');
    }

    if (item.Type === 'Audio' || item.Type === 'Episode') {
        showElement('#fldParentIndexNumber');

        if (item.Type === 'Episode') {
            (context.querySelector('#txtParentIndexNumber') as any).label(globalize.translate('LabelSeasonNumber'));
        } else if (item.Type === 'Audio') {
            (context.querySelector('#txtParentIndexNumber') as any).label(globalize.translate('LabelDiscNumber'));
        } else {
            (context.querySelector('#txtParentIndexNumber') as any).label(globalize.translate('LabelParentNumber'));
        }
    } else {
        hideElement('#fldParentIndexNumber', context);
    }

    if (item.Type === 'BoxSet') {
        showElement('#fldDisplayOrder', context);
        hideElement('.seriesDisplayOrderDescription', context);

        (context.querySelector('#selectDisplayOrder') as HTMLSelectElement).innerHTML = '<option value="Default">' + globalize.translate('DateModified') + '<option value="SortName">' + globalize.translate('SortName') + '</option><option value="PremiereDate">' + globalize.translate('ReleaseDate') + '</option>';
    } else if (item.Type === 'Series') {
        showElement('#fldDisplayOrder', context);
        showElement('.seriesDisplayOrderDescription', context);

        let html = '';
        html += '<option value="">' + globalize.translate('Aired') + '</option>';
        html += '<option value="originalAirDate">' + globalize.translate('OriginalAirDate') + '</option>';
        html += '<option value="absolute">' + globalize.translate('Absolute') + '</option>';
        html += '<option value="dvd">DVD</option></option>';
        html += '<option value="digital">' + globalize.translate('Digital') + '</option>';
        html += '<option value="storyArc">' + globalize.translate('StoryArc') + '</option>';
        html += '<option value="production">' + globalize.translate('Production') + '</option>';
        html += '<option value="tv">TV</option>';
        html += '<option value="alternate">' + globalize.translate('Alternate') + '</option>';
        html += '<option value="regional">' + globalize.translate('Regional') + '</option>';
        html += '<option value="altdvd">' + globalize.translate('AlternateDVD') + '</option>';

        (context.querySelector('#selectDisplayOrder') as HTMLSelectElement).innerHTML = html;
    } else {
        (context.querySelector('#selectDisplayOrder') as HTMLSelectElement).innerHTML = '';
        hideElement('#fldDisplayOrder', context);
    }
}

function fillItemInfo(context: HTMLElement, item: Item, parentalRatingOptions: ParentalRating[]): void {
    let select = context.querySelector('#selectOfficialRating') as HTMLSelectElement;

    populateRatings(parentalRatingOptions, select, item.OfficialRating);

    select.value = item.OfficialRating || '';

    select = context.querySelector('#selectCustomRating') as HTMLSelectElement;

    populateRatings(parentalRatingOptions, select, item.CustomRating);

    select.value = item.CustomRating || '';

    const selectStatus = context.querySelector('#selectStatus') as HTMLSelectElement;
    populateStatus(selectStatus);
    selectStatus.value = item.Status || '';

    (context.querySelector('#select3dFormat') as HTMLSelectElement).value = item.Video3DFormat || '';

    Array.prototype.forEach.call(context.querySelectorAll('.chkAirDay'), function (el: HTMLInputElement) {
        el.checked = (item.AirDays || []).indexOf(el.getAttribute('data-day') || '') !== -1;
    });

    populateListView(context.querySelector('#listGenres')!, item.Genres);
    populatePeople(context, item.People || []);

    populateListView(context.querySelector('#listStudios')!, (item.Studios || []).map(function (element) {
        return element.Name || '';
    }));

    populateListView(context.querySelector('#listTags')!, item.Tags);

    const lockData = (item.LockData || false);
    const chkLockData = context.querySelector('#chkLockData') as HTMLInputElement;
    chkLockData.checked = lockData;
    if (chkLockData.checked) {
        hideElement('.providerSettingsContainer', context);
    } else {
        showElement('.providerSettingsContainer', context);
    }
    fillMetadataSettings(context, item, item.LockedFields);

    (context.querySelector('#txtPath') as HTMLInputElement).value = item.Path || '';
    (context.querySelector('#txtName') as HTMLInputElement).value = item.Name || '';
    (context.querySelector('#txtOriginalName') as HTMLInputElement).value = item.OriginalTitle || '';
    (context.querySelector('#selectOriginalLanguage') as HTMLSelectElement).value = item.OriginalLanguage || '';
    (context.querySelector('#txtOverview') as HTMLTextAreaElement).value = item.Overview || '';
    (context.querySelector('#txtTagline') as HTMLInputElement).value = (item.Taglines?.length ? item.Taglines[0] : '');
    (context.querySelector('#txtSortName') as HTMLInputElement).value = item.ForcedSortName || '';
    (context.querySelector('#txtCommunityRating') as HTMLInputElement).value = item.CommunityRating || '';

    (context.querySelector('#txtCriticRating') as HTMLInputElement).value = item.CriticRating || '';

    (context.querySelector('#txtIndexNumber') as HTMLInputElement).value = item.IndexNumber == null ? '' : String(item.IndexNumber);
    (context.querySelector('#txtParentIndexNumber') as HTMLInputElement).value = item.ParentIndexNumber == null ? '' : String(item.ParentIndexNumber);

    (context.querySelector('#txtAirsBeforeSeason') as HTMLInputElement).value = ('AirsBeforeSeasonNumber' in item) ? String(item.AirsBeforeSeasonNumber) : '';
    (context.querySelector('#txtAirsAfterSeason') as HTMLInputElement).value = ('AirsAfterSeasonNumber' in item) ? String(item.AirsAfterSeasonNumber) : '';
    (context.querySelector('#txtAirsBeforeEpisode') as HTMLInputElement).value = ('AirsBeforeEpisodeNumber' in item) ? String(item.AirsBeforeEpisodeNumber) : '';

    (context.querySelector('#txtAlbum') as HTMLInputElement).value = item.Album || '';

    (context.querySelector('#txtAlbumArtist') as HTMLInputElement).value = (item.AlbumArtists || []).map(function (a) {
        return a.Name;
    }).join(';');

    (context.querySelector('#selectDisplayOrder') as HTMLSelectElement).value = item.DisplayOrder || '';

    (context.querySelector('#txtArtist') as HTMLInputElement).value = (item.ArtistItems || []).map(function (a) {
        return a.Name;
    }).join(';');

    let date: Date;

    if (item.DateCreated) {
        try {
            date = datetime.parseISO8601Date(item.DateCreated, true);

            (context.querySelector('#txtDateAdded') as HTMLInputElement).value = date.toISOString().slice(0, 10);
        } catch {
            (context.querySelector('#txtDateAdded') as HTMLInputElement).value = '';
        }
    } else {
        (context.querySelector('#txtDateAdded') as HTMLInputElement).value = '';
    }

    if (item.PremiereDate) {
        try {
            date = datetime.parseISO8601Date(item.PremiereDate, true);

            (context.querySelector('#txtPremiereDate') as HTMLInputElement).value = date.toISOString().slice(0, 10);
        } catch {
            (context.querySelector('#txtPremiereDate') as HTMLInputElement).value = '';
        }
    } else {
        (context.querySelector('#txtPremiereDate') as HTMLInputElement).value = '';
    }

    if (item.EndDate) {
        try {
            date = datetime.parseISO8601Date(item.EndDate, true);

            (context.querySelector('#txtEndDate') as HTMLInputElement).value = date.toISOString().slice(0, 10);
        } catch {
            (context.querySelector('#txtEndDate') as HTMLInputElement).value = '';
        }
    } else {
        (context.querySelector('#txtEndDate') as HTMLInputElement).value = '';
    }

    (context.querySelector('#txtProductionYear') as HTMLInputElement).value = String(item.ProductionYear || '');

    (context.querySelector('#txtAirTime') as HTMLInputElement).value = item.AirTime || '';

    const placeofBirth = item.ProductionLocations?.length ? item.ProductionLocations[0] : '';
    (context.querySelector('#txtPlaceOfBirth') as HTMLInputElement).value = placeofBirth;

    (context.querySelector('#selectHeight') as HTMLSelectElement).value = item.Height || '';

    (context.querySelector('#txtOriginalAspectRatio') as HTMLInputElement).value = item.AspectRatio || '';

    (context.querySelector('#selectLanguage') as HTMLSelectElement).value = item.PreferredMetadataLanguage || '';
    (context.querySelector('#selectCountry') as HTMLSelectElement).value = item.PreferredMetadataCountryCode || '';

    if (item.RunTimeTicks) {
        const minutes = item.RunTimeTicks / 600000000;

        (context.querySelector('#txtSeriesRuntime') as HTMLInputElement).value = String(Math.round(minutes));
    } else {
        (context.querySelector('#txtSeriesRuntime') as HTMLInputElement).value = '';
    }
}

function populateRatings(allParentalRatings: ParentalRating[], select: HTMLSelectElement, currentValue?: string): void {
    let html = '';

    html += "<option value=''></option>";

    const ratings: Array<{ Name: string; Value: string }> = [];
    let rating: ParentalRating;

    let currentValueFound = false;

    for (let i = 0, length = allParentalRatings.length; i < length; i++) {
        rating = allParentalRatings[i];

        ratings.push({ Name: rating.Name, Value: rating.Name });

        if (rating.Name === currentValue) {
            currentValueFound = true;
        }
    }

    if (currentValue && !currentValueFound) {
        ratings.push({ Name: currentValue, Value: currentValue });
    }

    for (let i = 0, length = ratings.length; i < length; i++) {
        rating = ratings[i];

        html += "<option value='" + escapeHtml(rating.Value) + "'>" + escapeHtml(rating.Name) + '</option>';
    }

    select.innerHTML = html;
}

function populateStatus(select: HTMLSelectElement): void {
    let html = '';
    html += '<option value=""></option>';
    html += `<option value="${SeriesStatus.Continuing}">${escapeHtml(globalize.translate('Continuing'))}</option>`;
    html += `<option value="${SeriesStatus.Ended}">${escapeHtml(globalize.translate('Ended'))}</option>`;
    html += `<option value="${SeriesStatus.Unreleased}">${escapeHtml(globalize.translate('Unreleased'))}</option>`;
    select.innerHTML = html;
}

function populateListView(list: HTMLElement, items?: string[] | null, sortCallback?: (items: string[]) => string[]): void {
    let listItems = items || [];
    if (typeof (sortCallback) === 'undefined') {
        listItems = listItems.sort(function (a, b) {
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });
    } else {
        listItems = sortCallback(listItems);
    }
    let html = '';
    for (let i = 0; i < listItems.length; i++) {
        html += '<div class="listItem">';

        html += '<span class="material-icons listItemIcon live_tv" aria-hidden="true" style="background-color:#333;"></span>';

        html += '<div class="listItemBody">';

        html += '<div class="textValue">';
        html += escapeHtml(listItems[i]);
        html += '</div>';

        html += '</div>';

        html += '<button type="button" is="paper-icon-button-light" data-index="' + i + '" class="btnRemoveFromEditorList autoSize"><span class="material-icons delete" aria-hidden="true"></span></button>';

        html += '</div>';
    }

    list.innerHTML = html;
}

function populatePeople(context: HTMLElement, people: Person[]): void {
    const lastType = '';
    let html = '';

    const elem = context.querySelector('#peopleList')!;

    for (let i = 0, length = people.length; i < length; i++) {
        const person = people[i];

        html += '<div class="listItem">';

        html += '<span class="material-icons listItemIcon person" style="background-color:#333;"></span>';

        html += '<div class="listItemBody">';
        html += '<button style="text-align:left;" type="button" class="btnEditPerson clearButton" data-index="' + i + '">';

        html += '<div class="textValue">';
        html += escapeHtml(person.Name || '');
        html += '</div>';

        if (person.Role && person.Role !== lastType) {
            html += '<div class="secondary">' + escapeHtml(person.Role) + '</div>';
        } else {
            html += '<div class="secondary">' + globalize.translate(person.Type || '') + '</div>';
        }

        html += '</button>';
        html += '</div>';

        html += '<button type="button" is="paper-icon-button-light" data-index="' + i + '" class="btnDeletePerson autoSize"><span class="material-icons delete" aria-hidden="true"></span></button>';

        html += '</div>';
    }

    elem.innerHTML = html;
}

function getLockedFieldsHtml(fields: LockedField[], currentFields: string[]): string {
    let html = '';
    for (const field of fields) {
        const name = field.name;
        const value = field.value || field.name;
        const checkedHtml = currentFields.indexOf(value) === -1 ? ' checked' : '';
        html += '<label>';
        html += '<input type="checkbox" is="emby-checkbox" class="selectLockedField" data-value="' + value + '"' + checkedHtml + '/>';
        html += '<span>' + name + '</span>';
        html += '</label>';
    }
    return html;
}

function fillMetadataSettings(context: HTMLElement, item: Item, lockedFields?: string[]): void {
    const container = context.querySelector('.providerSettingsContainer')!;
    const fields = lockedFields || [];

    const lockedFieldsList: LockedField[] = [
        { name: globalize.translate('Name'), value: 'Name' },
        { name: globalize.translate('Overview'), value: 'Overview' },
        { name: globalize.translate('Genres'), value: 'Genres' },
        { name: globalize.translate('ParentalRating'), value: 'OfficialRating' },
        { name: globalize.translate('People'), value: 'Cast' }
    ];

    if (item.Type === 'Person') {
        lockedFieldsList.push({ name: globalize.translate('BirthLocation'), value: 'ProductionLocations' });
    } else {
        lockedFieldsList.push({ name: globalize.translate('ProductionLocations'), value: 'ProductionLocations' });
    }

    if (item.Type === 'Series') {
        lockedFieldsList.push({ name: globalize.translate('Runtime'), value: 'Runtime' });
    }

    lockedFieldsList.push({ name: globalize.translate('Studios'), value: 'Studios' });
    lockedFieldsList.push({ name: globalize.translate('Tags'), value: 'Tags' });

    let html = '';

    html += '<h2>' + globalize.translate('HeaderEnabledFields') + '</h2>';
    html += '<p>' + globalize.translate('HeaderEnabledFieldsHelp') + '</p>';
    html += getLockedFieldsHtml(lockedFieldsList, fields);
    container.innerHTML = html;
}

function reload(context: HTMLElement, itemId: string, serverId: string): void {
    loading.show();

    Promise.all([getItem(itemId, serverId), getEditorConfig(itemId, serverId)]).then(function (responses) {
        const item = responses[0];
        metadataEditorInfo = responses[1];

        currentItem = item;

        const languages = metadataEditorInfo.Cultures || [];
        const countries = metadataEditorInfo.Countries || [];

        renderContentTypeOptions(context, metadataEditorInfo);

        loadExternalIds(context, item, metadataEditorInfo.ExternalIdInfos || []);

        populateLanguages(context.querySelector('#selectOriginalLanguage') as HTMLSelectElement, languages);
        populateLanguages(context.querySelector('#selectLanguage') as HTMLSelectElement, languages);
        populateCountries(context.querySelector('#selectCountry') as HTMLSelectElement, countries);

        const selectCountry = context.querySelector('#selectCountry') as HTMLSelectElement | null;
        if (selectCountry) {
            selectCountry.onchange = () => {
                syncMetadataLanguageFromCountry(context);
            };
        }

        setFieldVisibilities(context, item);
        fillItemInfo(context, item, metadataEditorInfo.ParentalRatingOptions || []);
        syncMetadataLanguageFromCountry(context);

        if (item.MediaType === 'Video' && item.Type !== 'Episode' && item.Type !== 'TvChannel') {
            showElement('#fldTagline', context);
        } else {
            hideElement('#fldTagline', context);
        }

        loading.hide();
    });
}

function centerFocus(elem: HTMLElement | null, horiz: boolean, on: boolean): void {
    import('../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        scrollHelper.centerFocus[fn](elem!, horiz);
    });
}

function show(itemId: string, serverId: string, resolve: () => void): void {
    loading.show();

    const dialogOptions = {
        removeOnClose: true,
        scrollY: false,
        size: '' as string
    };

    if (layoutManager.tv) {
        dialogOptions.size = 'fullscreen';
    } else {
        dialogOptions.size = 'small';
    }

    const dlg = dialogHelper.createDialog(dialogOptions);

    dlg.classList.add('formDialog');

    let html = '';

    html += globalize.translateHtml(template, 'core');

    dlg.innerHTML = html;

    if (layoutManager.tv) {
        centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, true);
    }

    dialogHelper.open(dlg);

    dlg.addEventListener('close', function () {
        if (layoutManager.tv) {
            centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, false);
        }

        resolve();
    });

    currentContext = dlg;

    init(dlg);

    reload(dlg, itemId, serverId);
}

export default {
    show: function (itemId: string, serverId: string): Promise<void> {
        return new Promise(resolve => show(itemId, serverId, resolve));
    },

    embed: function (elem: HTMLElement, itemId: string, serverId: string): Promise<void> {
        return new Promise(function (resolve) {
            loading.show();

            elem.innerHTML = globalize.translateHtml(template, 'core');

            elem.querySelector('.formDialogFooter')?.classList.remove('formDialogFooter');
            elem.querySelector('.btnClose')?.classList.add('hide');
            elem.querySelector('.btnHeaderSave')?.classList.remove('hide');
            elem.querySelector('.btnCancel')?.classList.add('hide');

            currentContext = elem;

            init(elem);
            reload(elem, itemId, serverId);

            focusManager.autoFocus(elem);

            resolve();
        });
    }
};
