import { playbackManager } from '../../components/playback/playbackmanager';
import loading from '../../components/loading/loading';
import libraryBrowser from '../../scripts/libraryBrowser';
import imageLoader from '../../components/images/imageLoader';
import AlphaPicker from '../../components/alphaPicker/alphaPicker';
import listView from '../../components/listview/listview';
import cardBuilder from '../../components/cardbuilder/cardBuilder';
import * as userSettings from '../../scripts/settings/userSettings';
import globalize from '../../lib/globalize';
import Events from '../../utils/events.ts';
import { setFilterStatus } from 'components/filterdialog/filterIndicator';

import '../../elements/emby-itemscontainer/emby-itemscontainer';

interface QueryParams {
    SortBy: string;
    SortOrder: string;
    IncludeItemTypes: string;
    Recursive: boolean;
    Fields: string;
    ImageTypeLimit: number;
    EnableImageTypes: string;
    StartIndex: number;
    Limit?: number;
    ParentId: string;
    NameStartsWith?: string;
    NameLessThan?: string;
}

interface PageData {
    query: QueryParams;
    view: string;
}

export default function (this: { showFilterMenu: () => void; getCurrentViewStyle: () => string; renderTab: () => void; alphaPicker?: any }, view: HTMLElement, params: { topParentId: string }, tabContent: HTMLElement) {
    function playAll(): void {
        ApiClient.getItem(ApiClient.getCurrentUserId(), params.topParentId).then(function (item: any) {
            playbackManager.play({
                items: [item]
            });
        });
    }

    function shuffle(): void {
        ApiClient.getItem(ApiClient.getCurrentUserId(), params.topParentId).then(function (item: any) {
            getQuery();
            playbackManager.shuffle(item);
        });
    }

    function getPageData(): PageData {
        const key = getSavedQueryKey();

        if (!pageData) {
            pageData = {
                query: {
                    SortBy: 'SortName',
                    SortOrder: 'Ascending',
                    IncludeItemTypes: 'MusicAlbum',
                    Recursive: true,
                    Fields: 'PrimaryImageAspectRatio,SortName',
                    ImageTypeLimit: 1,
                    EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
                    StartIndex: 0,
                    ParentId: params.topParentId
                },
                view: userSettings.getSavedView(key) || 'Poster'
            };

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
        return `${params.topParentId}-musicalbums`;
    }

    const onViewStyleChange = (): void => {
        const viewStyle = this.getCurrentViewStyle();
        const itemsContainer = tabContent.querySelector('.itemsContainer')!;

        if (viewStyle == 'List') {
            itemsContainer.classList.add('vertical-list');
            itemsContainer.classList.remove('vertical-wrap');
        } else {
            itemsContainer.classList.remove('vertical-list');
            itemsContainer.classList.add('vertical-wrap');
        }

        itemsContainer.innerHTML = '';
    };

    const reloadItems = (): void => {
        loading.show();
        isLoading = true;
        const query = getQuery();
        setFilterStatus(tabContent, query);

        ApiClient.getItems(ApiClient.getCurrentUserId(), query).then((result: any) => {
            function onNextPageClick(): void {
                if (isLoading) {
                    return;
                }

                if (userSettings.libraryPageSize() > 0) {
                    query.StartIndex += query.Limit!;
                }
                reloadItems();
            }

            function onPreviousPageClick(): void {
                if (isLoading) {
                    return;
                }

                if (userSettings.libraryPageSize() > 0) {
                    query.StartIndex = Math.max(0, query.StartIndex - query.Limit!);
                }
                reloadItems();
            }

            window.scrollTo(0, 0);
            this.alphaPicker?.updateControls(query);
            let html: string;
            const pagingHtml = libraryBrowser.getQueryPagingHtml({
                startIndex: query.StartIndex,
                limit: query.Limit ?? 0,
                totalRecordCount: result.TotalRecordCount,
                addLayoutButton: false,
                sortButton: false,
                filterButton: false
            });
            const viewStyle = this.getCurrentViewStyle();
            if (viewStyle == 'List') {
                html = listView.getListViewHtml({
                    items: result.Items,
                    context: 'music',
                    sortBy: query.SortBy,
                    addToListButton: true
                });
            } else if (viewStyle == 'PosterCard') {
                html = cardBuilder.getCardsHtml({
                    items: result.Items,
                    shape: 'square',
                    context: 'music',
                    showTitle: true,
                    coverImage: true,
                    showParentTitle: true,
                    lazy: true,
                    cardLayout: true
                });
            } else {
                html = cardBuilder.getCardsHtml({
                    items: result.Items,
                    shape: 'square',
                    context: 'music',
                    showTitle: true,
                    showParentTitle: true,
                    lazy: true,
                    centerText: true,
                    overlayPlayButton: true
                });
            }

            let elems = tabContent.querySelectorAll('.paging');

            for (const elem of elems) {
                elem.innerHTML = pagingHtml;
            }

            elems = tabContent.querySelectorAll('.btnNextPage');
            for (const elem of elems) {
                elem.addEventListener('click', onNextPageClick);
            }

            elems = tabContent.querySelectorAll('.btnPreviousPage');
            for (const elem of elems) {
                elem.addEventListener('click', onPreviousPageClick);
            }

            const itemsContainer = tabContent.querySelector('.itemsContainer')!;
            itemsContainer.innerHTML = html;
            imageLoader.lazyChildren(itemsContainer);
            userSettings.saveQuerySettings(getSavedQueryKey(), query as any);
            loading.hide();
            isLoading = false;

            import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
                autoFocuser.autoFocus(tabContent);
            });
        });
    };

    let pageData: PageData | undefined;
    let isLoading = false;

    this.showFilterMenu = function () {
        import('../../components/filterdialog/filterdialog').then(({ default: FilterDialog }) => {
            const filterDialog = new FilterDialog({
                query: getQuery(),
                mode: 'albums',
                serverId: ApiClient.serverId()
            });
            Events.on(filterDialog, 'filterchange', function () {
                getQuery().StartIndex = 0;
                reloadItems();
            });

            filterDialog.show();
        });
    };

    this.getCurrentViewStyle = function () {
        return getPageData().view;
    };

    const initPage = (tabElement: HTMLElement): void => {
        const alphaPickerElement = tabElement.querySelector('.alphaPicker') as HTMLElement;
        const itemsContainer = tabElement.querySelector('.itemsContainer') as HTMLElement;

        alphaPickerElement.addEventListener('alphavaluechanged', (function (e: CustomEvent) {
            const newValue = e.detail.value;
            const query = getQuery();
            if (newValue === '#') {
                query.NameLessThan = 'A';
                delete query.NameStartsWith;
            } else {
                query.NameStartsWith = newValue;
                delete query.NameLessThan;
            }
            query.StartIndex = 0;
            reloadItems();
        }) as EventListener);

        this.alphaPicker = new AlphaPicker({
            element: alphaPickerElement,
            valueChangeEvent: 'click'
        });

        tabElement.querySelector('.alphaPicker')!.classList.add('alphabetPicker-right');
        alphaPickerElement.classList.add('alphaPicker-fixed-right');
        itemsContainer.classList.add('padded-right-withalphapicker');

        tabElement.querySelector('.btnFilter')!.addEventListener('click', () => {
            this.showFilterMenu();
        });

        tabElement.querySelector('.btnSort')!.addEventListener('click', (e: Event) => {
            libraryBrowser.showSortMenu({
                items: [{
                    name: globalize.translate('Name'),
                    id: 'SortName'
                }, {
                    name: globalize.translate('AlbumArtist'),
                    id: 'AlbumArtist,SortName'
                }, {
                    name: globalize.translate('OptionCommunityRating'),
                    id: 'CommunityRating,SortName'
                }, {
                    name: globalize.translate('OptionCriticRating'),
                    id: 'CriticRating,SortName'
                }, {
                    name: globalize.translate('OptionDateAdded'),
                    id: 'DateCreated,SortName'
                }, {
                    name: globalize.translate('OptionReleaseDate'),
                    id: 'ProductionYear,PremiereDate,SortName'
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

        const btnSelectView = tabElement.querySelector('.btnSelectView')!;
        btnSelectView.addEventListener('click', (e: Event) => {
            libraryBrowser.showLayoutMenu(e.target as HTMLElement, this.getCurrentViewStyle(), 'List,Poster,PosterCard'.split(','));
        });

        btnSelectView.addEventListener('layoutchange', (function (e: CustomEvent) {
            const viewStyle = e.detail.viewStyle;
            getPageData().view = viewStyle;
            userSettings.saveViewSetting(getSavedQueryKey(), viewStyle);
            getQuery().StartIndex = 0;
            onViewStyleChange();
            reloadItems();
        }) as EventListener);

        tabElement.querySelector('.btnPlayAll')!.addEventListener('click', playAll);
        tabElement.querySelector('.btnShuffle')!.addEventListener('click', shuffle);
    };

    initPage(tabContent);
    onViewStyleChange();

    this.renderTab = () => {
        reloadItems();
        this.alphaPicker?.updateControls(getQuery());
    };
}
