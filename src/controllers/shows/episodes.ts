import loading from '../../components/loading/loading';
import libraryBrowser from '../../scripts/libraryBrowser';
import imageLoader from '../../components/images/imageLoader';
import listView from '../../components/listview/listview';
import cardBuilder from '../../components/cardbuilder/cardBuilder';
import * as userSettings from '../../scripts/settings/userSettings';
import globalize from '../../lib/globalize';
import Dashboard from '../../utils/dashboard';
import Events from '../../utils/events';
import { setFilterStatus } from 'components/filterdialog/filterIndicator';

import '../../elements/emby-itemscontainer/emby-itemscontainer';

interface PageData {
    query: any;
    view: string;
}

interface ViewParams {
    topParentId: string;
}

export default function (this: any, view: HTMLElement, params: ViewParams, tabContent: HTMLElement): void {
    function getPageData(): PageData {
        const key = getSavedQueryKey();
        let pageData = data[key];

        if (!pageData) {
            pageData = data[key] = {
                query: {
                    SortBy: 'SeriesSortName,SortName',
                    SortOrder: 'Ascending',
                    IncludeItemTypes: 'Episode',
                    Recursive: true,
                    Fields: 'PrimaryImageAspectRatio,MediaSourceCount',
                    IsMissing: false,
                    ImageTypeLimit: 1,
                    EnableImageTypes: 'Primary,Backdrop,Thumb',
                    StartIndex: 0
                },
                view: userSettings.getSavedView(key) || 'Poster'
            };

            if (userSettings.libraryPageSize() > 0) {
                pageData.query['Limit'] = userSettings.libraryPageSize();
            }

            pageData.query.ParentId = params.topParentId;
            userSettings.loadQuerySettings(key, pageData.query);
        }

        return pageData;
    }

    function getQuery(): any {
        return getPageData().query;
    }

    function getSavedQueryKey(): string {
        return `${params.topParentId}-episodes`;
    }

    function onViewStyleChange(): void {
        const viewStyle = self.getCurrentViewStyle();
        const itemsContainer = tabContent.querySelector('.itemsContainer') as HTMLElement;

        if (viewStyle == 'List') {
            itemsContainer.classList.add('vertical-list');
            itemsContainer.classList.remove('vertical-wrap');
        } else {
            itemsContainer.classList.remove('vertical-list');
            itemsContainer.classList.add('vertical-wrap');
        }

        itemsContainer.innerHTML = '';
    }

    function reloadItems(page: HTMLElement): void {
        loading.show();
        isLoading = true;
        const query = getQuery();
        setFilterStatus(page, query);

        ApiClient.getItems(Dashboard.getCurrentUserId(), query).then(function (result: any) {
            function onNextPageClick(): void {
                if (isLoading) {
                    return;
                }

                if (userSettings.libraryPageSize() > 0) {
                    query.StartIndex += query.Limit;
                }
                reloadItems(tabContent);
            }

            function onPreviousPageClick(): void {
                if (isLoading) {
                    return;
                }

                if (userSettings.libraryPageSize() > 0) {
                    query.StartIndex = Math.max(0, query.StartIndex - query.Limit);
                }
                reloadItems(tabContent);
            }

            window.scrollTo(0, 0);
            let html: string;
            const pagingHtml = (libraryBrowser as any).getQueryPagingHtml({
                startIndex: query.StartIndex,
                limit: query.Limit,
                totalRecordCount: result.TotalRecordCount,
                showLimit: false,
                updatePageSizeSetting: false,
                addLayoutButton: false,
                sortButton: false,
                filterButton: false
            });
            const viewStyle = self.getCurrentViewStyle();
            const itemsContainer = tabContent.querySelector('.itemsContainer') as HTMLElement;
            if (viewStyle == 'List') {
                html = listView.getListViewHtml({
                    items: result.Items,
                    sortBy: query.SortBy,
                    showParentTitle: true
                });
            } else if (viewStyle == 'PosterCard') {
                html = cardBuilder.getCardsHtml({
                    items: result.Items,
                    shape: 'backdrop',
                    showTitle: true,
                    showParentTitle: true,
                    scalable: true,
                    cardLayout: true
                });
            } else {
                html = cardBuilder.getCardsHtml({
                    items: result.Items,
                    shape: 'backdrop',
                    showTitle: true,
                    showParentTitle: true,
                    overlayText: false,
                    centerText: true,
                    scalable: true,
                    overlayPlayButton: true
                });
            }
            let elems: NodeListOf<HTMLElement>;

            elems = tabContent.querySelectorAll('.paging');
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

            itemsContainer.innerHTML = html;
            imageLoader.lazyChildren(itemsContainer);
            userSettings.saveQuerySettings(getSavedQueryKey(), query);
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

    self.showFilterMenu = function (): void {
        import('../../components/filterdialog/filterdialog').then(({ default: FilterDialog }) => {
            const filterDialog = new FilterDialog({
                query: getQuery(),
                mode: 'episodes',
                serverId: ApiClient.serverId()
            });
            Events.on(filterDialog, 'filterchange', function () {
                getQuery().StartIndex = 0;
                reloadItems(tabContent);
            });
            filterDialog.show();
        });
    };

    self.getCurrentViewStyle = function (): string {
        return getPageData().view;
    };

    function initPage(tabElement: HTMLElement): void {
        tabElement.querySelector('.btnFilter')!.addEventListener('click', function () {
            self.showFilterMenu();
        });
        tabElement.querySelector('.btnSort')!.addEventListener('click', function (e: Event) {
            (libraryBrowser as any).showSortMenu({
                items: [{
                    name: globalize.translate('Name'),
                    id: 'SeriesSortName,SortName'
                }, {
                    name: globalize.translate('OptionTvdbRating'),
                    id: 'CommunityRating,SeriesSortName,SortName'
                }, {
                    name: globalize.translate('OptionDateAdded'),
                    id: 'DateCreated,SeriesSortName,SortName'
                }, {
                    name: globalize.translate('OptionPremiereDate'),
                    id: 'PremiereDate,SeriesSortName,SortName'
                }, {
                    name: globalize.translate('OptionDatePlayed'),
                    id: 'DatePlayed,SeriesSortName,SortName'
                }, {
                    name: globalize.translate('OptionParentalRating'),
                    id: 'OfficialRating,SeriesSortName,SortName'
                }, {
                    name: globalize.translate('OptionPlayCount'),
                    id: 'PlayCount,SeriesSortName,SortName'
                }, {
                    name: globalize.translate('Runtime'),
                    id: 'Runtime,SeriesSortName,SortName'
                }],
                callback: function () {
                    reloadItems(tabElement);
                },
                query: getQuery(),
                button: e.target
            });
        });
        const btnSelectView = tabElement.querySelector('.btnSelectView') as HTMLElement;
        btnSelectView.addEventListener('click', function (e: Event) {
            libraryBrowser.showLayoutMenu(e.target as HTMLElement, self.getCurrentViewStyle(), 'List,Poster,PosterCard'.split(','));
        });
        btnSelectView.addEventListener('layoutchange', function (e: any) {
            const viewStyle = e.detail.viewStyle;
            getPageData().view = viewStyle;
            userSettings.saveViewSetting(getSavedQueryKey(), viewStyle);
            onViewStyleChange();
            reloadItems(tabElement);
        });
    }

    initPage(tabContent);
    onViewStyleChange();

    self.renderTab = function (): void {
        reloadItems(tabContent);
    };
}
