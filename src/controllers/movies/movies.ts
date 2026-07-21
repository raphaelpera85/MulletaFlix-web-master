import loading from '../../components/loading/loading';
import * as userSettings from '../../scripts/settings/userSettings';
import libraryBrowser from '../../scripts/libraryBrowser';
import { AlphaPicker } from '../../components/alphaPicker/alphaPicker';
import listView from '../../components/listview/listview';
import cardBuilder from '../../components/cardbuilder/cardBuilder';
import globalize from '../../lib/globalize';
import Events from '../../utils/events';
import { playbackManager } from '../../components/playback/playbackmanager';
import { getFilterStatus, setFilterStatus } from 'components/filterdialog/filterIndicator';

import '../../elements/emby-itemscontainer/emby-itemscontainer';

interface QueryOptions {
    SortBy?: string;
    SortOrder?: string;
    IncludeItemTypes?: string;
    Recursive?: boolean;
    Fields?: string;
    ImageTypeLimit?: number;
    EnableImageTypes?: string;
    StartIndex?: number;
    ParentId?: string;
    Limit?: number;
    NameLessThan?: string;
    NameStartsWith?: string;
    IsFavorite?: boolean;
}

interface ViewParams {
    topParentId: string;
    tab?: string;
}

interface TabOptions {
    mode?: string;
}

export default function (this: any, view: HTMLElement, params: ViewParams, tabContent: HTMLElement, options: TabOptions): void {
    const onViewStyleChange = (): void => {
        if (this.getCurrentViewStyle() == 'List') {
            itemsContainer.classList.add('vertical-list');
            itemsContainer.classList.remove('vertical-wrap');
        } else {
            itemsContainer.classList.remove('vertical-list');
            itemsContainer.classList.add('vertical-wrap');
        }

        itemsContainer.innerHTML = '';
    };

    function fetchData(): Promise<any> {
        isLoading = true;
        loading.show();
        return ApiClient.getItems(ApiClient.getCurrentUserId(), query);
    }

    function playAll(): void {
        ApiClient.getItem(ApiClient.getCurrentUserId(), params.topParentId).then(function (item: any) {
            playbackManager.play({
                items: [item]
            });
        });
    }

    function shuffle(): Promise<void> {
        isLoading = true;
        loading.show();
        const newQuery = { ...query, SortBy: 'Random', StartIndex: 0, Limit: 300, Fields: 'PrimaryImageAspectRatio,MediaSourceCount,Chapters,Trickplay' };
        return ApiClient.getItems(ApiClient.getCurrentUserId(), newQuery).then(({ Items }: any) => {
            playbackManager.play({
                items: Items,
                autoplay: true
            });
        }).finally(() => {
            isLoading = false;
        });
    }

    const afterRefresh = (result: any): void => {
        setFilterStatus(tabContent, query);

        function onNextPageClick(): void {
            if (isLoading) {
                return;
            }

            if (userSettings.libraryPageSize() > 0) {
                query.StartIndex! += query.Limit!;
            }
            itemsContainer.refreshItems();
        }

        function onPreviousPageClick(): void {
            if (isLoading) {
                return;
            }

            if (userSettings.libraryPageSize() > 0) {
                query.StartIndex = Math.max(0, query.StartIndex! - query.Limit!);
            }
            itemsContainer.refreshItems();
        }

        window.scrollTo(0, 0);
        this.alphaPicker?.updateControls(query);
        const pagingHtml = (libraryBrowser as any).getQueryPagingHtml({
            startIndex: query.StartIndex,
            limit: query.Limit,
            showLimit: false,
            totalRecordCount: result.TotalRecordCount,
            updatePageSizeSetting: false,
            addLayoutButton: false,
            sortButton: false,
            filterButton: false
        });

        for (const elem of tabContent.querySelectorAll('.paging')) {
            elem.innerHTML = pagingHtml;
        }

        for (const elem of tabContent.querySelectorAll('.btnNextPage')) {
            elem.addEventListener('click', onNextPageClick);
        }

        for (const elem of tabContent.querySelectorAll('.btnPreviousPage')) {
            elem.addEventListener('click', onPreviousPageClick);
        }

        tabContent.querySelector('.btnPlayAll')?.classList.toggle('hide', result.TotalRecordCount < 1);
        tabContent.querySelector('.btnShuffle')?.classList.toggle('hide', result.TotalRecordCount < 1);

        isLoading = false;
        loading.hide();

        import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
            autoFocuser.autoFocus(tabContent);
        });
    };

    const getItemsHtml = (items: any[]): string => {
        let html: string;
        const viewStyle = this.getCurrentViewStyle();

        if (viewStyle == 'Thumb') {
            html = cardBuilder.getCardsHtml({
                items: items,
                shape: 'backdrop',
                preferThumb: true,
                context: 'movies',
                lazy: true,
                overlayPlayButton: true,
                showTitle: true,
                showYear: true,
                centerText: true
            });
        } else if (viewStyle == 'ThumbCard') {
            html = cardBuilder.getCardsHtml({
                items: items,
                shape: 'backdrop',
                preferThumb: true,
                context: 'movies',
                lazy: true,
                cardLayout: true,
                showTitle: true,
                showYear: true,
                centerText: true
            });
        } else if (viewStyle == 'Banner') {
            html = cardBuilder.getCardsHtml({
                items: items,
                shape: 'banner',
                preferBanner: true,
                context: 'movies',
                lazy: true
            });
        } else if (viewStyle == 'List') {
            html = listView.getListViewHtml({
                items: items,
                context: 'movies',
                sortBy: query.SortBy
            });
        } else if (viewStyle == 'PosterCard') {
            html = cardBuilder.getCardsHtml({
                items: items,
                shape: 'portrait',
                context: 'movies',
                showTitle: true,
                showYear: true,
                centerText: true,
                lazy: true,
                cardLayout: true
            });
        } else {
            html = cardBuilder.getCardsHtml({
                items: items,
                shape: 'portrait',
                context: 'movies',
                overlayPlayButton: true,
                showTitle: true,
                showYear: true,
                centerText: true
            });
        }

        return html;
    };

    const initPage = (tabElement: HTMLElement): void => {
        itemsContainer.fetchData = fetchData;
        itemsContainer.getItemsHtml = getItemsHtml;
        itemsContainer.afterRefresh = afterRefresh;
        const alphaPickerElement = tabElement.querySelector('.alphaPicker');

        if (alphaPickerElement) {
            alphaPickerElement.addEventListener('alphavaluechanged', function (e: any) {
                const newValue = e.detail.value;
                if (newValue === '#') {
                    query.NameLessThan = 'A';
                    delete query.NameStartsWith;
                } else {
                    query.NameStartsWith = newValue;
                    delete query.NameLessThan;
                }
                query.StartIndex = 0;
                itemsContainer.refreshItems();
            });
            this.alphaPicker = new AlphaPicker({
                element: alphaPickerElement as HTMLElement,
                valueChangeEvent: 'click'
            });

            (tabElement.querySelector('.alphaPicker') as HTMLElement)!.classList.add('alphabetPicker-right');
            (alphaPickerElement as HTMLElement).classList.add('alphaPicker-fixed-right');
            itemsContainer.classList.add('padded-right-withalphapicker');
        }

        const btnFilter = tabElement.querySelector('.btnFilter');

        if (btnFilter) {
            btnFilter.addEventListener('click', () => {
                this.showFilterMenu();
            });
        }
        const btnSort = tabElement.querySelector('.btnSort');

        if (btnSort) {
            btnSort.addEventListener('click', function (e: Event) {
                (libraryBrowser as any).showSortMenu({
                    items: [{
                        name: globalize.translate('Name'),
                        id: 'SortName,ProductionYear'
                    }, {
                        name: globalize.translate('OptionRandom'),
                        id: 'Random'
                    }, {
                        name: globalize.translate('OptionCommunityRating'),
                        id: 'CommunityRating,SortName,ProductionYear'
                    }, {
                        name: globalize.translate('OptionCriticRating'),
                        id: 'CriticRating,SortName,ProductionYear'
                    }, {
                        name: globalize.translate('OptionDateAdded'),
                        id: 'DateCreated,SortName,ProductionYear'
                    }, {
                        name: globalize.translate('OptionDatePlayed'),
                        id: 'DatePlayed,SortName,ProductionYear'
                    }, {
                        name: globalize.translate('OptionParentalRating'),
                        id: 'OfficialRating,SortName,ProductionYear'
                    }, {
                        name: globalize.translate('OptionPlayCount'),
                        id: 'PlayCount,SortName,ProductionYear'
                    }, {
                        name: globalize.translate('OptionReleaseDate'),
                        id: 'PremiereDate,SortName,ProductionYear'
                    }, {
                        name: globalize.translate('Runtime'),
                        id: 'Runtime,SortName,ProductionYear'
                    }],
                    callback: function () {
                        query.StartIndex = 0;
                        userSettings.saveQuerySettings(savedQueryKey, query as Record<string, unknown>);
                        itemsContainer.refreshItems();
                    },
                    query: query,
                    button: e.target
                });
            });
        }
        const btnSelectView = tabElement.querySelector('.btnSelectView') as HTMLElement;
        btnSelectView.addEventListener('click', (e: Event) => {
            libraryBrowser.showLayoutMenu(e.target as HTMLElement, this.getCurrentViewStyle(), 'Banner,List,Poster,PosterCard,Thumb,ThumbCard'.split(','));
        });
        btnSelectView.addEventListener('layoutchange', function (e: any) {
            const viewStyle = e.detail.viewStyle;
            userSettings.set(savedViewKey, viewStyle);
            query.StartIndex = 0;
            onViewStyleChange();
            itemsContainer.refreshItems();
        });

        tabElement.querySelector('.btnPlayAll')!.addEventListener('click', playAll);
        tabElement.querySelector('.btnShuffle')?.addEventListener('click', shuffle);
    };

    let itemsContainer = tabContent.querySelector('.itemsContainer') as any;
    const savedQueryKey = params.topParentId + '-' + options.mode;
    const savedViewKey = savedQueryKey + '-view';
    let query: QueryOptions = {
        SortBy: 'SortName,ProductionYear',
        SortOrder: 'Ascending',
        IncludeItemTypes: 'Movie',
        Recursive: true,
        Fields: 'PrimaryImageAspectRatio,MediaSourceCount',
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
        StartIndex: 0,
        ParentId: params.topParentId
    };

    if (userSettings.libraryPageSize() > 0) {
        query['Limit'] = userSettings.libraryPageSize();
    }

    let isLoading = false;

    if (options.mode === 'favorites') {
        query.IsFavorite = true;
    }

    query = userSettings.loadQuerySettings(savedQueryKey, query as Record<string, unknown>);

    this.showFilterMenu = function (): void {
        import('../../components/filterdialog/filterdialog').then(({ default: FilterDialog }) => {
            const filterDialog = new FilterDialog({
                query: query,
                mode: 'movies',
                serverId: ApiClient.serverId(),
                hasFilters: getFilterStatus(query)
            });
            Events.on(filterDialog, 'filterchange', () => {
                query.StartIndex = 0;
                userSettings.saveQuerySettings(savedQueryKey, query as Record<string, unknown>);
                itemsContainer.refreshItems();
            });
            filterDialog.show();
        });
    };

    this.getCurrentViewStyle = function (): string {
        return userSettings.get(savedViewKey) || 'Poster';
    };

    this.initTab = function (): void {
        initPage(tabContent);
        onViewStyleChange();
    };

    this.renderTab = (): void => {
        itemsContainer.refreshItems();
        this.alphaPicker?.updateControls(query);
    };

    this.destroy = function (): void {
        itemsContainer = null;
    };
}
