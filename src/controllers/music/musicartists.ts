import loading from '../../components/loading/loading';
import libraryBrowser from '../../scripts/libraryBrowser';
import imageLoader from '../../components/images/imageLoader';
import { AlphaPicker } from '../../components/alphaPicker/alphaPicker';
import listView from '../../components/listview/listview';
import cardBuilder from '../../components/cardbuilder/cardBuilder';
import * as userSettings from '../../scripts/settings/userSettings';
import Events from '../../utils/events.ts';
import { setFilterStatus } from 'components/filterdialog/filterIndicator';

import '../../elements/emby-itemscontainer/emby-itemscontainer';

interface QueryParams {
    SortBy: string;
    SortOrder: string;
    Recursive: boolean;
    Fields: string;
    StartIndex: number;
    ImageTypeLimit: number;
    EnableImageTypes: string;
    Limit?: number;
    ParentId: string;
    NameStartsWith?: string;
    NameLessThan?: string;
}

interface PageData {
    query: QueryParams;
    view: string;
}

interface ArtistOptions {
    mode?: string;
}

export default function (this: { showFilterMenu: () => void; getCurrentViewStyle: () => string; renderTab: () => void; alphaPicker?: any }, view: HTMLElement, params: { topParentId: string }, tabContent: HTMLElement, options: ArtistOptions) {
    function getPageData(): PageData {
        const key = getSavedQueryKey();
        let pageData = data[key] as PageData | undefined;

        if (!pageData) {
            const queryValues: QueryParams = {
                SortBy: 'SortName',
                SortOrder: 'Ascending',
                Recursive: true,
                Fields: 'PrimaryImageAspectRatio,SortName',
                StartIndex: 0,
                ImageTypeLimit: 1,
                EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
                ParentId: params.topParentId
            };

            if (userSettings.libraryPageSize() > 0) {
                queryValues['Limit'] = userSettings.libraryPageSize();
            }

            pageData = data[key] = {
                query: queryValues,
                view: userSettings.getSavedView(key) || 'Poster'
            };
            userSettings.loadQuerySettings(key, pageData.query as any);
        }

        return pageData!;
    }

    function getQuery(): QueryParams {
        return getPageData().query;
    }

    function getSavedQueryKey(): string {
        return `${params.topParentId}-${options.mode}`;
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

        const promise = options.mode == 'albumartists' ?
            ApiClient.getAlbumArtists(ApiClient.getCurrentUserId(), query as any) :
            ApiClient.getArtists(ApiClient.getCurrentUserId(), query as any);
        promise.then((result: any) => {
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
                    sortBy: query.SortBy
                });
            } else if (viewStyle == 'PosterCard') {
                html = cardBuilder.getCardsHtml({
                    items: result.Items,
                    shape: 'square',
                    context: 'music',
                    showTitle: true,
                    coverImage: true,
                    cardLayout: true
                });
            } else {
                html = cardBuilder.getCardsHtml({
                    items: result.Items,
                    shape: 'square',
                    context: 'music',
                    showTitle: true,
                    coverImage: true,
                    lazy: true,
                    centerText: true,
                    overlayPlayButton: true
                });
            }
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
            loading.hide();
            isLoading = false;

            import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
                autoFocuser.autoFocus(tabContent);
            });
        });
    };

    const data: Record<string, PageData> = {};
    let isLoading = false;

    this.showFilterMenu = function () {
        import('../../components/filterdialog/filterdialog').then(({ default: FilterDialog }) => {
            const filterDialog = new FilterDialog({
                query: getQuery(),
                mode: options.mode,
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
    };

    initPage(tabContent);
    onViewStyleChange();

    this.renderTab = () => {
        reloadItems();
        this.alphaPicker?.updateControls(getQuery());
    };
}
