import cardBuilder from '../../components/cardbuilder/cardBuilder';
import imageLoader from '../../components/images/imageLoader';
import libraryBrowser from '../../scripts/libraryBrowser';
import loading from '../../components/loading/loading';
import * as userSettings from '../../scripts/settings/userSettings';
import Events from '../../utils/events.ts';
import { setFilterStatus } from 'components/filterdialog/filterIndicator';

import '../../elements/emby-itemscontainer/emby-itemscontainer';

declare const ApiClient: {
    serverId(): string;
    getCurrentUserId(): string;
    getLiveTvChannels(query: Query): Promise<{ Items: Channel[]; TotalRecordCount: number }>;
};

interface Query {
    StartIndex: number;
    Fields: string;
    Limit?: number;
    UserId?: string;
    [key: string]: unknown;
}

interface PageData {
    query: Query;
}

interface CardOptions {
    items: Channel[];
    shape: string;
    showTitle: boolean;
    lazy: boolean;
    cardLayout: boolean;
    showDetailsMenu: boolean;
    showCurrentProgram: boolean;
    showCurrentProgramTime: boolean;
}

interface Channel {
    [key: string]: unknown;
}

interface LiveTvChannelsController {
    renderTab: () => void;
}

export default function (
    this: LiveTvChannelsController,
    view: HTMLElement,
    params: any,
    tabContent: HTMLElement
): void {
    let pageData: PageData | undefined;
    let isLoading = false;

    function getPageData(): PageData {
        if (!pageData) {
            pageData = {
                query: {
                    StartIndex: 0,
                    Fields: 'PrimaryImageAspectRatio'
                }
            };
        }

        if (userSettings.libraryPageSize() > 0) {
            pageData.query['Limit'] = userSettings.libraryPageSize();
        }

        return pageData;
    }

    function getQuery(): Query {
        return getPageData().query;
    }

    function getChannelsHtml(channels: Channel[]): string {
        return cardBuilder.getCardsHtml({
            items: channels,
            shape: 'square',
            showTitle: true,
            lazy: true,
            cardLayout: true,
            showDetailsMenu: true,
            showCurrentProgram: true,
            showCurrentProgramTime: true
        });
    }

    function renderChannels(context: HTMLElement, result: { Items: Channel[]; TotalRecordCount: number }): void {
        const query = getQuery();

        function onNextPageClick(): void {
            if (isLoading) {
                return;
            }

            if (userSettings.libraryPageSize() > 0) {
                query.StartIndex += query.Limit!;
            }
            reloadItems(context).then(() => {
                window.scrollTo(0, 0);
            });
        }

        function onPreviousPageClick(): void {
            if (isLoading) {
                return;
            }

            if (userSettings.libraryPageSize() > 0) {
                query.StartIndex = Math.max(0, query.StartIndex - query.Limit!);
            }
            reloadItems(context).then(() => {
                window.scrollTo(0, 0);
            });
        }

        for (const elem of context.querySelectorAll<HTMLElement>('.paging')) {
            elem.innerHTML = libraryBrowser.getQueryPagingHtml({
                startIndex: query.StartIndex,
                limit: query.Limit ?? 0,
                totalRecordCount: result.TotalRecordCount,
                filterButton: false
            });
        }

        const html = getChannelsHtml(result.Items);
        const elem = context.querySelector<HTMLElement>('#items')!;
        elem.innerHTML = html;
        imageLoader.lazyChildren(elem);

        let elems: NodeListOf<HTMLElement>;
        let i: number;
        let length: number;

        for (elems = context.querySelectorAll<HTMLElement>('.btnNextPage'), i = 0, length = elems.length; i < length; i++) {
            elems[i].addEventListener('click', onNextPageClick);
        }

        for (elems = context.querySelectorAll<HTMLElement>('.btnPreviousPage'), i = 0, length = elems.length; i < length; i++) {
            elems[i].addEventListener('click', onPreviousPageClick);
        }
    }

    function showFilterMenu(context: HTMLElement): void {
        import('../../components/filterdialog/filterdialog').then(({ default: FilterDialog }) => {
            const filterDialog = new FilterDialog({
                query: getQuery(),
                mode: 'livetvchannels',
                serverId: ApiClient.serverId()
            });
            Events.on(filterDialog, 'filterchange', function () {
                reloadItems(context);
            });
            filterDialog.show();
        });
    }

    function reloadItems(context: HTMLElement): Promise<void> {
        loading.show();
        isLoading = true;
        const query = getQuery();
        setFilterStatus(context, query);

        const apiClient = ApiClient;
        query.UserId = apiClient.getCurrentUserId();
        return apiClient.getLiveTvChannels(query).then(function (result) {
            renderChannels(context, result);
            loading.hide();
            isLoading = false;

            import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
                autoFocuser.autoFocus(context);
            });
        });
    }

    const self = this as LiveTvChannelsController;
    tabContent.querySelector<HTMLElement>('.btnFilter')!.addEventListener('click', function () {
        showFilterMenu(tabContent);
    });

    self.renderTab = function (): void {
        reloadItems(tabContent);
    };
}
