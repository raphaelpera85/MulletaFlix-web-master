
import escapeHtml from 'escape-html';

import { getUserViewsQuery } from 'hooks/api/useUserViews';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { queryClient } from 'utils/query/queryClient';

import layoutManager from '../layoutManager';
import focusManager from '../focusManager';
import globalize from '../../lib/globalize';
import loading from '../loading/loading';
import Events from '../../utils/events';
import homeSections from '../homesections/homesections';
import dom from '../../utils/dom';
import '../listview/listview.scss';
import '../../elements/emby-select/emby-select';
import '../../elements/emby-checkbox/emby-checkbox';
import toast from '../toast/toast';
import template from './homeScreenSettings.template.html';
import { LibraryTab } from '../../types/libraryTab';

interface UserConfiguration {
    GroupedFolders?: string[];
    MyMediaExcludes?: string[];
    LatestItemsExcludes?: string[];
    OrderedViews?: string[];
    HidePlayedInLatest?: boolean;
    [key: string]: unknown;
}

interface User {
    Id: string;
    Configuration: UserConfiguration;
    [key: string]: unknown;
}

interface UserView {
    Id: string;
    Name?: string;
    Type?: string;
    CollectionType?: string;
    [key: string]: unknown;
}

interface UserViewsResult {
    Items: UserView[];
    [key: string]: unknown;
}

interface HomeScreenSettingsOptions {
    element: HTMLElement;
    userId: string;
    serverId: string;
    userSettings: UserSettingsInstance;
    enableSaveButton?: boolean;
    enableSaveConfirmation?: boolean;
    autoFocus?: boolean;
    [key: string]: unknown;
}

interface UserSettingsInstance {
    get: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
    setUserInfo: (userId: string, apiClient: unknown) => Promise<void>;
    [key: string]: unknown;
}

interface LandingScreenOption {
    name: string;
    value: string;
    isDefault?: boolean;
}

const numConfigurableSections = 10;

function renderViews(page: HTMLElement, user: User, result: Array<{ Id: string; Name?: string }>): void {
    let folderHtml = '';

    folderHtml += '<div class="checkboxList">';
    folderHtml += result.map(i => {
        let currentHtml = '';

        const id = `chkGroupFolder${i.Id}`;

        const isChecked = user.Configuration.GroupedFolders?.includes(i.Id);

        const checkedHtml = isChecked ? ' checked="checked"' : '';

        currentHtml += '<label>';
        currentHtml += `<input type="checkbox" is="emby-checkbox" class="chkGroupFolder" data-folderid="${i.Id}" id="${id}"${checkedHtml}/>`;
        currentHtml += `<span>${escapeHtml(i.Name || '')}</span>`;
        currentHtml += '</label>';

        return currentHtml;
    }).join('');

    folderHtml += '</div>';

    page.querySelector('.folderGroupList')!.innerHTML = folderHtml;
}

function getLandingScreenOptions(type: string): LandingScreenOption[] {
    const list: LandingScreenOption[] = [];

    if (type === 'movies') {
        list.push(
            {
                name: globalize.translate('Movies'),
                value: LibraryTab.Movies,
                isDefault: true
            },
            {
                name: globalize.translate('Suggestions'),
                value: LibraryTab.Suggestions
            },
            {
                name: globalize.translate('Favorites'),
                value: LibraryTab.Favorites
            },
            {
                name: globalize.translate('Collections'),
                value: LibraryTab.Collections
            },
            {
                name: globalize.translate('Genres'),
                value: LibraryTab.Genres
            },
            {
                name: globalize.translate('Studios'),
                value: LibraryTab.Studios
            },
            {
                name: globalize.translate('Playlists'),
                value: LibraryTab.Playlists
            }
        );
    } else if (type === 'tvshows') {
        list.push(
            {
                name: globalize.translate('Shows'),
                value: LibraryTab.Series,
                isDefault: true
            },
            {
                name: globalize.translate('Suggestions'),
                value: LibraryTab.Suggestions
            },
            {
                name: globalize.translate('TabUpcoming'),
                value: LibraryTab.Upcoming
            },
            {
                name: globalize.translate('Genres'),
                value: LibraryTab.Genres
            },
            {
                name: globalize.translate('Studios'),
                value: LibraryTab.Studios
            },
            {
                name: globalize.translate('Episodes'),
                value: LibraryTab.Episodes
            },
            {
                name: globalize.translate('Collections'),
                value: LibraryTab.Collections
            },
            {
                name: globalize.translate('Playlists'),
                value: LibraryTab.Playlists
            }
        );
    } else if (type === 'music') {
        list.push(
            {
                name: globalize.translate('Albums'),
                value: LibraryTab.Albums,
                isDefault: true
            },
            {
                name: globalize.translate('Suggestions'),
                value: LibraryTab.Suggestions
            },
            {
                name: globalize.translate('HeaderAlbumArtists'),
                value: LibraryTab.AlbumArtists
            },
            {
                name: globalize.translate('Artists'),
                value: LibraryTab.Artists
            },
            {
                name: globalize.translate('Playlists'),
                value: LibraryTab.Playlists
            },
            {
                name: globalize.translate('Songs'),
                value: LibraryTab.Songs
            },
            {
                name: globalize.translate('Genres'),
                value: LibraryTab.Genres
            },
            {
                name: globalize.translate('Collections'),
                value: LibraryTab.Collections
            }
        );
    } else if (type === 'livetv') {
        list.push(
            {
                name: globalize.translate('Programs'),
                value: LibraryTab.Programs,
                isDefault: true
            },
            {
                name: globalize.translate('Guide'),
                value: LibraryTab.Guide
            },
            {
                name: globalize.translate('Channels'),
                value: LibraryTab.Channels
            },
            {
                name: globalize.translate('Recordings'),
                value: LibraryTab.Recordings
            },
            {
                name: globalize.translate('Schedule'),
                value: LibraryTab.Schedule
            },
            {
                name: globalize.translate('Series'),
                value: LibraryTab.SeriesTimers
            }
        );
    } else if (type === 'homevideos') {
        list.push(
            {
                name: globalize.translate('Folders'),
                value: LibraryTab.Folders,
                isDefault: true
            },
            {
                name: globalize.translate('Photos'),
                value: LibraryTab.Photos
            },
            {
                name: globalize.translate('HeaderPhotoAlbums'),
                value: LibraryTab.PhotoAlbums
            },
            {
                name: globalize.translate('HeaderVideos'),
                value: LibraryTab.Videos
            }
        );
    } else if (type === 'musicvideos') {
        list.push(
            {
                name: globalize.translate('Folders'),
                value: LibraryTab.Folders,
                isDefault: true
            },
            {
                name: globalize.translate('Suggestions'),
                value: LibraryTab.Suggestions
            },
            {
                name: globalize.translate('HeaderVideos'),
                value: LibraryTab.MusicVideos
            },
            {
                name: globalize.translate('Playlists'),
                value: LibraryTab.Playlists
            }
        );
    } else if (type === 'mixed') {
        list.push(
            {
                name: globalize.translate('Folders'),
                value: LibraryTab.Folders,
                isDefault: true
            },
            {
                name: globalize.translate('Suggestions'),
                value: LibraryTab.Suggestions
            },
            {
                name: globalize.translate('HeaderMedia'),
                value: LibraryTab.Mixed
            },
            {
                name: globalize.translate('Collections'),
                value: LibraryTab.Collections
            },
            {
                name: globalize.translate('Playlists'),
                value: LibraryTab.Playlists
            }
        );
    }

    return list;
}

function getLandingScreenOptionsHtml(type: string, userValue: string | undefined): string {
    return getLandingScreenOptions(type).map(o => {
        const selected = userValue === o.value || (o.isDefault && !userValue);
        const selectedHtml = selected ? ' selected' : '';
        const optionValue = o.isDefault ? '' : o.value;

        return `<option value="${optionValue}"${selectedHtml}>${escapeHtml(o.name)}</option>`;
    }).join('');
}

function renderViewOrder(context: HTMLElement, user: User, result: UserViewsResult): void {
    let html = '';

    html += result.Items.map((view) => {
        let currentHtml = '';

        currentHtml += `<div class="listItem viewItem" data-viewid="${view.Id}">`;

        currentHtml += '<span class="material-icons listItemIcon folder_open" aria-hidden="true"></span>';

        currentHtml += '<div class="listItemBody">';

        currentHtml += '<div>';
        currentHtml += escapeHtml(view.Name || '');
        currentHtml += '</div>';

        currentHtml += '</div>';

        currentHtml += `<button type="button" is="paper-icon-button-light" class="btnViewItemUp btnViewItemMove autoSize" title="${globalize.translate('Up')}"><span class="material-icons keyboard_arrow_up" aria-hidden="true"></span></button>`;
        currentHtml += `<button type="button" is="paper-icon-button-light" class="btnViewItemDown btnViewItemMove autoSize" title="${globalize.translate('Down')}"><span class="material-icons keyboard_arrow_down" aria-hidden="true"></span></button>`;

        currentHtml += '</div>';

        return currentHtml;
    }).join('');

    context.querySelector('.viewOrderList')!.innerHTML = html;
}

function updateHomeSectionValues(context: HTMLElement, userSettingsInstance: UserSettingsInstance): void {
    for (let i = 1; i <= numConfigurableSections; i++) {
        const select = context.querySelector(`#selectHomeSection${i}`) as HTMLSelectElement;
        const defaultValue = homeSections.getDefaultSection(i - 1);

        const option = select.querySelector(`option[value="${defaultValue}"]`) || select.querySelector('option[value=""]');

        const userValue = userSettingsInstance.get(`homesection${i - 1}`);

        if (option) (option as HTMLOptionElement).value = '';

        if (userValue === defaultValue || !userValue) {
            select.value = '';
        } else {
            select.value = userValue;
        }
    }

    (context.querySelector('.selectTVHomeScreen') as HTMLSelectElement).value = userSettingsInstance.get('tvhome') || '';
}

function getPerLibrarySettingsHtml(item: UserView, user: User, userSettingsInstance: UserSettingsInstance): string {
    const collectionType = (item.Type === 'CollectionFolder' && item.CollectionType == null) ? 'mixed' : item.CollectionType;

    let html = '';

    let isChecked: boolean;

    if (item.Type === 'Channel' || collectionType === 'boxsets' || collectionType === 'playlists') {
        isChecked = !(user.Configuration.MyMediaExcludes || []).includes(item.Id);
        html += '<div>';
        html += '<label>';
        html += `<input type="checkbox" is="emby-checkbox" class="chkIncludeInMyMedia" data-folderid="${item.Id}"${isChecked ? ' checked="checked"' : ''}/>`;
        html += `<span>${globalize.translate('DisplayInMyMedia')}</span>`;
        html += '</label>';
        html += '</div>';
    }

    const excludeFromLatest = ['playlists', 'livetv', 'boxsets', 'channels'];
    if (!excludeFromLatest.includes(collectionType || '')) {
        isChecked = !user.Configuration.LatestItemsExcludes?.includes(item.Id);
        html += '<label class="fldIncludeInLatest">';
        html += `<input type="checkbox" is="emby-checkbox" class="chkIncludeInLatest" data-folderid="${item.Id}"${isChecked ? ' checked="checked"' : ''}/>`;
        html += `<span>${globalize.translate('DisplayInOtherHomeScreenSections')}</span>`;
        html += '</label>';
    }

    if (html) {
        html = `<div class="checkboxListContainer">${html}</div>`;
    }

    const landingScreenTypes = ['movies', 'tvshows', 'music', 'livetv', 'homevideos', 'musicvideos', 'mixed'];
    if (landingScreenTypes.includes(collectionType || '')) {
        const idForLanding = collectionType === 'livetv' ? collectionType : item.Id;
        html += '<div class="selectContainer">';
        html += `<select is="emby-select" class="selectLanding" data-folderid="${idForLanding}" label="${globalize.translate('LabelDefaultScreen')}">`;

        const userValue = userSettingsInstance.get(`landing-${idForLanding}`);

        html += getLandingScreenOptionsHtml(collectionType || '', userValue);

        html += '</select>';
        html += '</div>';
    }

    if (html) {
        let prefix = '';
        prefix += '<div class="verticalSection">';

        prefix += '<h2 class="sectionTitle">';
        prefix += escapeHtml(item.Name || '');
        prefix += '</h2>';

        html = prefix + html;
        html += '</div>';
    }

    return html;
}

function renderPerLibrarySettings(context: HTMLElement, user: User, userViews: UserView[], userSettingsInstance: UserSettingsInstance): void {
    const elem = context.querySelector('.perLibrarySettings')!;
    let html = '';

    for (let i = 0, length = userViews.length; i < length; i++) {
        html += getPerLibrarySettingsHtml(userViews[i], user, userSettingsInstance);
    }

    elem.innerHTML = html;
}

function loadForm(context: HTMLElement, user: User, userSettingsInstance: UserSettingsInstance, apiClient: unknown): void {
    (context.querySelector('.chkHidePlayedFromLatest') as HTMLInputElement).checked = user.Configuration.HidePlayedInLatest || false;

    updateHomeSectionValues(context, userSettingsInstance);

    const promise1 = queryClient
        .fetchQuery(getUserViewsQuery(
            toApi(apiClient as any),
            {
                userId: user.Id,
                includeHidden: true
            }
        ));
    const promise2 = (apiClient as any).getJSON((apiClient as any).getUrl(`Users/${user.Id}/GroupingOptions`));

    Promise.all([promise1, promise2]).then(responses => {
        renderViewOrder(context, user, responses[0] as UserViewsResult);

        renderPerLibrarySettings(context, user, (responses[0] as UserViewsResult).Items, userSettingsInstance);

        renderViews(context, user, responses[1] as Array<{ Id: string; Name?: string }>);

        loading.hide();
    });
}

function onSectionOrderListClick(e: Event): void {
    const target = dom.parentWithClass((e as MouseEvent).target as HTMLElement, 'btnViewItemMove');

    if (target) {
        const viewItem = dom.parentWithClass(target, 'viewItem');

        if (viewItem) {
            if (target.classList.contains('btnViewItemDown')) {
                const next = viewItem.nextSibling;

                if (next) {
                    viewItem.parentNode?.removeChild(viewItem);
                    next.parentNode?.insertBefore(viewItem, next.nextSibling);
                    focusManager.focus((e as MouseEvent).target as Element);
                }
            } else {
                const prev = viewItem.previousSibling;

                if (prev) {
                    viewItem.parentNode?.removeChild(viewItem);
                    prev.parentNode?.insertBefore(viewItem, prev);
                    focusManager.focus((e as MouseEvent).target as Element);
                }
            }
        }
    }
}

function getCheckboxItems(selector: string, context: HTMLElement, isChecked: boolean): HTMLInputElement[] {
    const inputs = context.querySelectorAll(selector);
    const list: HTMLInputElement[] = [];

    for (let i = 0, length = inputs.length; i < length; i++) {
        if ((inputs[i] as HTMLInputElement).checked === isChecked) {
            list.push(inputs[i] as HTMLInputElement);
        }
    }

    return list;
}

function saveUser(context: HTMLElement, user: User, userSettingsInstance: UserSettingsInstance, apiClient: unknown): Promise<void> {
    user.Configuration.HidePlayedInLatest = (context.querySelector('.chkHidePlayedFromLatest') as HTMLInputElement).checked;

    user.Configuration.LatestItemsExcludes = getCheckboxItems('.chkIncludeInLatest', context, false).map(i => {
        return i.getAttribute('data-folderid') || '';
    });

    user.Configuration.MyMediaExcludes = getCheckboxItems('.chkIncludeInMyMedia', context, false).map(i => {
        return i.getAttribute('data-folderid') || '';
    });

    user.Configuration.GroupedFolders = getCheckboxItems('.chkGroupFolder', context, true).map(i => {
        return i.getAttribute('data-folderid') || '';
    });

    const viewItems = context.querySelectorAll('.viewItem');
    const orderedViews: string[] = [];
    let i: number;
    let length: number;
    for (i = 0, length = viewItems.length; i < length; i++) {
        orderedViews.push(viewItems[i].getAttribute('data-viewid') || '');
    }

    user.Configuration.OrderedViews = orderedViews;

    userSettingsInstance.set('tvhome', (context.querySelector('.selectTVHomeScreen') as HTMLSelectElement).value);

    userSettingsInstance.set('homesection0', (context.querySelector('#selectHomeSection1') as HTMLSelectElement).value);
    userSettingsInstance.set('homesection1', (context.querySelector('#selectHomeSection2') as HTMLSelectElement).value);
    userSettingsInstance.set('homesection2', (context.querySelector('#selectHomeSection3') as HTMLSelectElement).value);
    userSettingsInstance.set('homesection3', (context.querySelector('#selectHomeSection4') as HTMLSelectElement).value);
    userSettingsInstance.set('homesection4', (context.querySelector('#selectHomeSection5') as HTMLSelectElement).value);
    userSettingsInstance.set('homesection5', (context.querySelector('#selectHomeSection6') as HTMLSelectElement).value);
    userSettingsInstance.set('homesection6', (context.querySelector('#selectHomeSection7') as HTMLSelectElement).value);
    userSettingsInstance.set('homesection7', (context.querySelector('#selectHomeSection8') as HTMLSelectElement).value);
    userSettingsInstance.set('homesection8', (context.querySelector('#selectHomeSection9') as HTMLSelectElement).value);
    userSettingsInstance.set('homesection9', (context.querySelector('#selectHomeSection10') as HTMLSelectElement).value);

    const selectLandings = context.querySelectorAll('.selectLanding');
    for (i = 0, length = selectLandings.length; i < length; i++) {
        const selectLanding = selectLandings[i] as HTMLSelectElement;
        userSettingsInstance.set(`landing-${selectLanding.getAttribute('data-folderid')}`, selectLanding.value);
    }

    return (apiClient as any).updateUserConfiguration(user.Id, user.Configuration);
}

function save(instance: HomeScreenSettings, context: HTMLElement, userId: string, userSettingsInstance: UserSettingsInstance, apiClient: unknown, enableSaveConfirmation?: boolean): void {
    loading.show();

    (apiClient as any).getUser(userId).then((user: User) => {
        saveUser(context, user, userSettingsInstance, apiClient).then(() => {
            loading.hide();
            if (enableSaveConfirmation) {
                toast(globalize.translate('SettingsSaved'));
            }

            Events.trigger(instance, 'saved');
        }, () => {
            loading.hide();
        });
    });
}

function onSubmit(this: HomeScreenSettings, e?: Event): void {
    const self = this;
    const apiClient = ServerConnections.getApiClient(self.options.serverId);
    const userId = self.options.userId;
    const userSettingsInstance = self.options.userSettings;

    userSettingsInstance.setUserInfo(userId, apiClient).then(() => {
        const enableSaveConfirmation = self.options.enableSaveConfirmation;
        save(self, self.options.element, userId, userSettingsInstance, apiClient, enableSaveConfirmation);
    });

    // Disable default form submission
    if (e) {
        e.preventDefault();
    }
}

function onChange(e: Event): void {
    const chkIncludeInMyMedia = dom.parentWithClass((e.target as HTMLElement), 'chkIncludeInMyMedia');
    if (!chkIncludeInMyMedia) {
        return;
    }

    const section = dom.parentWithClass(chkIncludeInMyMedia, 'verticalSection');
    const fldIncludeInLatest = section?.querySelector('.fldIncludeInLatest');
    if (fldIncludeInLatest) {
        if ((chkIncludeInMyMedia.querySelector('input') as HTMLInputElement).checked) {
            fldIncludeInLatest.classList.remove('hide');
        } else {
            fldIncludeInLatest.classList.add('hide');
        }
    }
}

function embed(options: HomeScreenSettingsOptions, self: HomeScreenSettings): void {
    let workingTemplate = template;
    for (let i = 1; i <= numConfigurableSections; i++) {
        workingTemplate = workingTemplate.replace(`{section${i}label}`, globalize.translate('LabelHomeScreenSectionValue', String(i)));
    }

    options.element.innerHTML = globalize.translateHtml(workingTemplate, 'core');

    options.element.querySelector('.viewOrderList')?.addEventListener('click', onSectionOrderListClick);
    options.element.querySelector('form')?.addEventListener('submit', onSubmit.bind(self));
    options.element.addEventListener('change', onChange);

    if (options.enableSaveButton) {
        options.element.querySelector('.btnSave')?.classList.remove('hide');
    }

    if (layoutManager.tv) {
        options.element.querySelector('.selectTVHomeScreenContainer')?.classList.remove('hide');
    } else {
        options.element.querySelector('.selectTVHomeScreenContainer')?.classList.add('hide');
    }

    self.loadData(options.autoFocus);
}

class HomeScreenSettings {
    options: HomeScreenSettingsOptions;
    dataLoaded: boolean = false;

    constructor(options: HomeScreenSettingsOptions) {
        this.options = options;
        embed(options, this);
    }

    loadData(autoFocus?: boolean): void {
        const self = this;
        const context = self.options.element;

        loading.show();

        const userId = self.options.userId;
        const apiClient = ServerConnections.getApiClient(self.options.serverId);
        const userSettingsInstance = self.options.userSettings;

        (apiClient as any).getUser(userId).then((user: User) => {
            userSettingsInstance.setUserInfo(userId, apiClient).then(() => {
                self.dataLoaded = true;

                loadForm(context, user, userSettingsInstance, apiClient);

                if (autoFocus) {
                    focusManager.autoFocus(context);
                }
            });
        });
    }

    submit(): void {
        onSubmit.call(this);
    }

    destroy(): void {
        this.options = null!;
    }
}

export default HomeScreenSettings;
