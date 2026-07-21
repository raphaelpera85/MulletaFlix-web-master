import type { ApiClient } from 'jellyfin-apiclient';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { getStudiosApi } from '@jellyfin/sdk/lib/utils/api/studios-api';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getBackdropShape, getPortraitShape, getSquareShape } from 'components/cardbuilder/utils/shape';
import focusManager from 'components/focusManager';
import layoutManager from 'components/layoutManager';
import { appRouter } from 'components/router/appRouter';
import dom from 'utils/dom';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import 'elements/emby-itemscontainer/emby-itemscontainer';
import 'elements/emby-scroller/emby-scroller';

interface Section {
    name: string;
    types: string;
    shape: string;
    showTitle: boolean;
    showYear?: boolean;
    showParentTitle?: boolean;
    overlayPlayButton?: boolean;
    overlayText?: boolean;
    overlayMoreButton?: boolean;
    centerText: boolean;
    preferThumb?: boolean;
    action?: string;
    coverImage?: boolean;
}

interface FetchOptions {
    SortBy: string;
    SortOrder: string;
    Filters: string;
    Recursive: boolean;
    Fields: string;
    CollapseBoxSetItems: boolean;
    ExcludeLocationTypes: string;
    EnableTotalRecordCount: boolean;
    Limit: number;
    IncludeItemTypes?: string;
}

function enableScrollX(): boolean {
    return true;
}

function getSections(): Section[] {
    return [{
        name: 'Movies',
        types: 'Movie',
        shape: getPortraitShape(enableScrollX()),
        showTitle: true,
        showYear: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'Shows',
        types: 'Series',
        shape: getPortraitShape(enableScrollX()),
        showTitle: true,
        showYear: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'HeaderSeasons',
        types: BaseItemKind.Season,
        shape: getPortraitShape(enableScrollX()),
        showTitle: true,
        showParentTitle: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'Episodes',
        types: 'Episode',
        shape: getBackdropShape(enableScrollX()),
        preferThumb: false,
        showTitle: true,
        showParentTitle: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'HeaderVideos',
        types: 'Video',
        shape: getBackdropShape(enableScrollX()),
        preferThumb: true,
        showTitle: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'MusicVideos',
        types: 'MusicVideo',
        shape: getBackdropShape(enableScrollX()),
        preferThumb: true,
        showTitle: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'Collections',
        types: 'BoxSet',
        shape: getPortraitShape(enableScrollX()),
        showTitle: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'Playlists',
        types: 'Playlist',
        shape: getSquareShape(enableScrollX()),
        preferThumb: false,
        showTitle: true,
        overlayText: false,
        showParentTitle: false,
        centerText: true,
        overlayPlayButton: true,
        coverImage: true
    }, {
        name: 'Studios',
        types: BaseItemKind.Studio,
        shape: getBackdropShape(enableScrollX()),
        preferThumb: true,
        showTitle: true,
        overlayText: false,
        centerText: true,
        overlayPlayButton: true
    }, {
        name: 'People',
        types: 'Person',
        shape: getPortraitShape(enableScrollX()),
        preferThumb: false,
        showTitle: true,
        overlayText: false,
        showParentTitle: false,
        centerText: true,
        overlayPlayButton: true,
        coverImage: true
    }, {
        name: 'Artists',
        types: 'MusicArtist',
        shape: getSquareShape(enableScrollX()),
        preferThumb: false,
        showTitle: true,
        overlayText: false,
        showParentTitle: false,
        centerText: true,
        overlayPlayButton: true,
        coverImage: true
    }, {
        name: 'Albums',
        types: 'MusicAlbum',
        shape: getSquareShape(enableScrollX()),
        preferThumb: false,
        showTitle: true,
        overlayText: false,
        showParentTitle: true,
        centerText: true,
        overlayPlayButton: true,
        coverImage: true
    }, {
        name: 'Songs',
        types: 'Audio',
        shape: getSquareShape(enableScrollX()),
        preferThumb: false,
        showTitle: true,
        overlayText: false,
        showParentTitle: true,
        centerText: true,
        overlayMoreButton: true,
        action: 'instantmix',
        coverImage: true
    }, {
        name: 'Books',
        types: 'Book',
        shape: getPortraitShape(enableScrollX()),
        showTitle: true,
        showYear: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'Channels',
        types: 'LiveTVChannel',
        shape: getBackdropShape(enableScrollX()),
        showTitle: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'HeaderPhotoAlbums',
        types: 'PhotoAlbum',
        shape: getBackdropShape(enableScrollX()),
        showTitle: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }, {
        name: 'Photos',
        types: 'Photo',
        shape: getBackdropShape(enableScrollX()),
        showTitle: true,
        overlayPlayButton: true,
        overlayText: false,
        centerText: true
    }];
}

function getFetchDataFn(section: Section): (this: FavoritesTab) => Promise<unknown> {
    return function (this: FavoritesTab): Promise<unknown> {
        const apiClient = this.apiClient!;
        const options: FetchOptions = {
            SortBy: [ItemSortBy.SeriesSortName, ItemSortBy.SortName].join(','),
            SortOrder: 'Ascending',
            Filters: 'IsFavorite',
            Recursive: true,
            Fields: 'PrimaryImageAspectRatio',
            CollapseBoxSetItems: false,
            ExcludeLocationTypes: 'Virtual',
            EnableTotalRecordCount: false,
            Limit: 20
        };
        const userId: string = apiClient.getCurrentUserId();

        if (section.types === BaseItemKind.Studio) {
            return getStudiosApi(toApi(apiClient as never))
                .getStudios({
                    userId,
                    isFavorite: true,
                    fields: [ItemFields.PrimaryImageAspectRatio],
                    enableImageTypes: [ImageType.Thumb],
                    enableTotalRecordCount: false,
                    limit: options.Limit
                })
                .then(({ data }: { data: unknown }) => data);
        }

        if (section.types === 'MusicArtist') {
            return apiClient.getArtists(userId, options);
        }

        if (section.types === 'Person') {
            return apiClient.getPeople(userId, options);
        }

        options.IncludeItemTypes = section.types;
        return apiClient.getItems(userId, options);
    };
}

function getRouteUrl(section: Section, serverId: string): string {
    return appRouter.getRouteUrl('list', {
        serverId: serverId,
        itemTypes: section.types,
        isFavorite: true
    });
}

interface LeadingButton {
    name: string;
    id: string;
    icon: string;
    routeUrl: string;
}

interface CardsOptions {
    items: unknown[];
    preferThumb?: boolean;
    shape: string;
    centerText: boolean;
    overlayText: boolean;
    showTitle: boolean;
    showYear?: boolean;
    showParentTitle?: boolean;
    scalable: boolean;
    coverImage?: boolean;
    overlayPlayButton?: boolean;
    overlayMoreButton?: boolean;
    action?: string;
    allowBottomPadding: boolean;
    cardLayout: boolean;
    leadingButtons: LeadingButton[] | null;
    lines: number;
}

function getItemsHtmlFn(section: Section): (this: FavoritesTab, items: unknown[]) => string {
    return function (this: FavoritesTab, items: unknown[]): string {
        const cardLayout: boolean = false;
        const serverId: string = this.apiClient!.serverId();
        const leadingButtons: LeadingButton[] | null = layoutManager.tv ? [{
            name: globalize.translate('All'),
            id: 'more',
            icon: 'favorite',
            routeUrl: getRouteUrl(section, serverId)
        }] : null;
        let lines: number = 0;

        if (section.showTitle) {
            lines++;
        }

        if (section.showYear) {
            lines++;
        }

        if (section.showParentTitle) {
            lines++;
        }

        const cardsOptions: CardsOptions = {
            items: items,
            preferThumb: section.preferThumb,
            shape: section.shape,
            centerText: section.centerText && !cardLayout,
            overlayText: section.overlayText !== false,
            showTitle: section.showTitle,
            showYear: section.showYear,
            showParentTitle: section.showParentTitle,
            scalable: true,
            coverImage: section.coverImage,
            overlayPlayButton: section.overlayPlayButton,
            overlayMoreButton: section.overlayMoreButton && !cardLayout,
            action: section.action,
            allowBottomPadding: !enableScrollX(),
            cardLayout: cardLayout,
            leadingButtons: leadingButtons,
            lines: lines
        };
        return cardBuilder.getCardsHtml(cardsOptions);
    };
}

function createSections(instance: FavoritesTab, elem: HTMLElement, apiClient: ApiClient): void {
    const sections: Section[] = getSections();
    let html: string = '';

    for (const section of sections) {
        let sectionClass: string = 'verticalSection';

        if (!section.showTitle) {
            sectionClass += ' verticalSection-extrabottompadding';
        }

        html += '<div class="' + sectionClass + ' hide">';
        html += '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">';

        if (layoutManager.tv) {
            html += '<h2 class="sectionTitle sectionTitle-cards">' + globalize.translate(section.name) + '</h2>';
        } else {
            html += '<a is="emby-linkbutton" href="' + getRouteUrl(section, apiClient.serverId()) + '" class="more button-flat button-flat-mini sectionTitleTextButton">';
            html += '<h2 class="sectionTitle sectionTitle-cards">';
            html += globalize.translate(section.name);
            html += '</h2>';
            html += '<span class="material-icons chevron_right" aria-hidden="true"></span>';
            html += '</a>';
        }

        html += '</div>';
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true"><div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x" data-monitor="markfavorite"></div></div>';
        html += '</div>';
    }

    elem.innerHTML = html;
    (customElements as unknown as { upgradeSubtree: (root: Node) => void }).upgradeSubtree(elem);

    const elems = elem.querySelectorAll<HTMLElement>('.itemsContainer');

    for (let i = 0, length = elems.length; i < length; i++) {
        const itemsContainer = elems[i] as HTMLElement & {
            fetchData: () => Promise<unknown>;
            getItemsHtml: (items: unknown[]) => string;
            parentContainer: HTMLElement | null;
        };
        itemsContainer.fetchData = getFetchDataFn(sections[i]).bind(instance);
        itemsContainer.getItemsHtml = getItemsHtmlFn(sections[i]).bind(instance);
        itemsContainer.parentContainer = dom.parentWithClass(itemsContainer, 'verticalSection');
    }
}

class FavoritesTab {
    view: HTMLElement;
    params: Record<string, unknown>;
    apiClient: ApiClient | null;
    sectionsContainer: HTMLElement | null;

    constructor(view: HTMLElement, params: Record<string, unknown>) {
        this.view = view;
        this.params = params;
        this.apiClient = ServerConnections.currentApiClient() as unknown as ApiClient | null;
        this.sectionsContainer = view.querySelector<HTMLElement>('.sections');
        createSections(this, this.sectionsContainer!, this.apiClient!);
    }

    onResume(options: { autoFocus?: boolean }): void {
        const promises: Promise<void>[] = [];
        const view = this.view;
        const elems = this.sectionsContainer!.querySelectorAll<HTMLElement & { resume: (options: unknown) => Promise<void> }>('.itemsContainer');

        for (const elem of elems) {
            promises.push(elem.resume(options));
        }

        Promise.all(promises).then(function () {
            if (options.autoFocus) {
                focusManager.autoFocus(view);
            }
        });
    }

    onPause(): void {
        if (this.sectionsContainer) {
            Array.from(this.sectionsContainer.querySelectorAll<HTMLElement & { pause: () => void }>('.itemsContainer'))
                .forEach(e => { e.pause(); });
        }
    }

    destroy(): void {
        this.view = null as unknown as HTMLElement;
        this.params = null as unknown as Record<string, unknown>;
        this.apiClient = null;
        const elems = this.sectionsContainer!.querySelectorAll<HTMLElement & { fetchData: unknown; getItemsHtml: unknown; parentContainer: unknown }>('.itemsContainer');

        for (const elem of elems) {
            elem.fetchData = null;
            elem.getItemsHtml = null;
            elem.parentContainer = null;
        }

        this.sectionsContainer = null;
    }
}

export default FavoritesTab;
