
import libraryBrowser from '../../scripts/libraryBrowser';
import imageLoader from '../../components/images/imageLoader';
import listView from '../../components/listview/listview';
import loading from '../../components/loading/loading';
import { playbackManager } from '../../components/playback/playbackmanager';
import * as userSettings from '../../scripts/settings/userSettings';
import globalize from '../../lib/globalize';
import Dashboard from '../../utils/dashboard';
import Events from '../../utils/events.ts';
import { setFilterStatus } from 'components/filterdialog/filterIndicator';

import '../../elements/emby-itemscontainer/emby-itemscontainer';

interface QueryParams {
    SortBy: string;
    SortOrder: string;
    IncludeItemTypes: string;
    Recursive: boolean;
    Fields: string;
    StartIndex: number;
    Limit?: number;
    ImageTypeLimit: number;
    EnableImageTypes: string;
    ParentId: string;
}

interface PageData {
    query: QueryParams;
    view?: string;
}

export default function (this: { showFilterMenu: () => void; getCurrentViewStyle: () => string | undefined; renderTab: () => void }, view: HTMLElement, params: { topParentId: string }, tabContent: HTMLElement) {
    function getPageData(): PageData {
        const key = getSavedQueryKey();
        let pageData = data[key] as PageData | undefined;

        if (!pageData) {
            pageData = data[key] = {
                query: {
                    SortBy: 'Album,SortName',
                    SortOrder: 'Ascending',
                    IncludeItemTypes: 'Audio',
                    Recursive: true,
                    Fields: 'ParentId',
                    StartIndex: 0,
                    ImageTypeLimit: 1,
                    EnableImageTypes: 'Primary',
                    ParentId: params.topParentId
                }
            } as PageData;

            if (userSettings.libraryPageSize() > 0) {
                pageData.query['Limit'] = userSettings.libraryPageSize();
            }

            userSettings.loadQuerySettings(key, pageData.query as any);
        }

        return pageData!;
    }

    function getQuery(): QueryParams {
        return getPageData().query;
    }

    function getSavedQueryKey(): string {
        return `${params.topParentId}-songs`;
    }

    function reloadItems(page?: HTMLElement): void {
        loading.show();
        isLoading = true;
        const query = getQuery();
        setFilterStatus(tabContent, query);

        ApiClient.getItems(Dashboard.getCurrentUserId(), query).then(function (result: any) {
            function onNextPageClick(): void {
                if (isLoading) {
                    return;
                }

                if (userSettings.libraryPageSize() > 0) {
                    query.StartIndex += query.Limit!;
                }
                reloadItems(tabContent);
            }

            function onPreviousPageClick(): void {
                if (isLoading) {
                    return;
                }

                if (userSettings.libraryPageSize() > 0) {
                    query.StartIndex = Math.max(0, query.StartIndex - query.Limit!);
                }
                reloadItems(tabContent);
            }

            window.scrollTo(0, 0);
            const pagingHtml = libraryBrowser.getQueryPagingHtml({
                startIndex: query.StartIndex,
                limit: query.Limit ?? 0,
                totalRecordCount: result.TotalRecordCount,
                addLayoutButton: false,
                sortButton: false,
                filterButton: false
            });
            const html = listView.getListViewHtml({
                items: result.Items,
                action: 'playallfromhere',
                smallIcon: true,
                artist: true,
                addToListButton: true
            });
            let elems = tabContent.querySelectorAll('.paging');

            for (let i = 0, length = elems.length; i < length; i++) {
                elems[i].innerHTML = pagingHtml;
            }

            elems = tabContent.querySelectorAll('.btnNextPage');
            for (let i = 0, length = elems.length; i < length; i++) {
                elems[i].addEventListener('click', onNextPageClick);
            }

            elems = tabContent.querySelectorAll('.btnPreviousPage');
            for (let i = 0, length = elems.length; i < length; i++) {
                elems[i].addEventListener('click', onPreviousPageClick);
            }

            const itemsContainer = tabContent.querySelector('.itemsContainer')!;
            itemsContainer.innerHTML = html;
            imageLoader.lazyChildren(itemsContainer);
            userSettings.saveQuerySettings(getSavedQueryKey(), query as any);

            tabContent.querySelector('.btnShuffle')!.classList.toggle('hide', result.TotalRecordCount < 1);

            loading.hide();
            isLoading = false;

            import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
                autoFocuser.autoFocus(page);
            });
        });
    }

    const self = this;
    const data: Record<string, PageData> = {};
    let isLoading = false;

    self.showFilterMenu = function () {
        import('../../components/filterdialog/filterdialog').then(({ default: FilterDialog }) => {
            const filterDialog = new FilterDialog({
                query: getQuery(),
                mode: 'songs',
                serverId: ApiClient.serverId()
            });
            Events.on(filterDialog, 'filterchange', function () {
                getQuery().StartIndex = 0;
                reloadItems();
            });
            filterDialog.show();
        });
    };

    function shuffle(): void {
        ApiClient.getItem(ApiClient.getCurrentUserId(), params.topParentId).then(function (item: any) {
            playbackManager.shuffle(item);
        });
    }

    self.getCurrentViewStyle = function () {
        return getPageData().view;
    };

    function initPage(tabElement: HTMLElement): void {
        tabElement.querySelector('.btnFilter')!.addEventListener('click', function () {
            self.showFilterMenu();
        });
        tabElement.querySelector('.btnSort')!.addEventListener('click', function (e: Event) {
            libraryBrowser.showSortMenu({
                items: [{
                    name: globalize.translate('OptionTrackName'),
                    id: 'Name'
                }, {
                    name: globalize.translate('Album'),
                    id: 'Album,AlbumArtist,SortName'
                }, {
                    name: globalize.translate('AlbumArtist'),
                    id: 'AlbumArtist,Album,SortName'
                }, {
                    name: globalize.translate('Artist'),
                    id: 'Artist,Album,SortName'
                }, {
                    name: globalize.translate('OptionDateAdded'),
                    id: 'DateCreated,SortName'
                }, {
                    name: globalize.translate('OptionDatePlayed'),
                    id: 'DatePlayed,SortName'
                }, {
                    name: globalize.translate('OptionPlayCount'),
                    id: 'PlayCount,SortName'
                }, {
                    name: globalize.translate('OptionReleaseDate'),
                    id: 'PremiereDate,AlbumArtist,Album,SortName'
                }, {
                    name: globalize.translate('Runtime'),
                    id: 'Runtime,AlbumArtist,Album,SortName'
                }, {
                    name: globalize.translate('OptionRandom'),
                    id: 'Random,SortName'
                }],
                callback: function () {
                    getQuery().StartIndex = 0;
                    reloadItems();
                },
                query: getQuery()
            });
        });
        tabElement.querySelector('.btnShuffle')!.addEventListener('click', shuffle);
    }

    initPage(tabContent);

    self.renderTab = function () {
        reloadItems(tabContent);
    };
}
