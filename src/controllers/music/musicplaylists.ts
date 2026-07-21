import * as userSettings from '../../scripts/settings/userSettings';
import cardBuilder from '../../components/cardbuilder/cardBuilder';
import imageLoader from '../../components/images/imageLoader';
import loading from '../../components/loading/loading';

interface QueryParams {
    SortBy: string;
    SortOrder: string;
    IncludeItemTypes: string;
    Recursive: boolean;
    Fields: string;
    StartIndex: number;
    ParentId?: string;
}

interface PageData {
    query: QueryParams;
    view: string;
}

export default function (this: { getCurrentViewStyle: () => string; preRender: () => void; renderTab: () => void }, view: HTMLElement, params: { topParentId: string }, tabContent: HTMLElement) {
    function getPageData(): PageData {
        const key = getSavedQueryKey();
        let pageData = data[key] as PageData | undefined;

        if (!pageData) {
            pageData = data[key] = {
                query: {
                    SortBy: 'SortName',
                    SortOrder: 'Ascending',
                    IncludeItemTypes: 'Playlist',
                    Recursive: true,
                    Fields: 'PrimaryImageAspectRatio,SortName,CanDelete',
                    StartIndex: 0,
                    ParentId: params.topParentId
                },
                view: userSettings.getSavedView(key) || 'Poster'
            };
            userSettings.loadQuerySettings(key, pageData.query as any);
        }

        return pageData;
    }

    function getQuery(): QueryParams {
        return getPageData().query;
    }

    function getSavedQueryKey(): string {
        return `${params.topParentId}-musicplaylists`;
    }

    function getPromise(): Promise<any> {
        loading.show();
        const query = getQuery();
        return ApiClient.getItems(ApiClient.getCurrentUserId(), query as any);
    }

    function reloadItems(context: HTMLElement, promise: Promise<any>): void {
        const query = getQuery();
        promise.then(function (result: any) {
            let html = '';
            html = cardBuilder.getCardsHtml({
                items: result.Items,
                shape: 'square',
                showTitle: true,
                coverImage: true,
                centerText: true,
                overlayPlayButton: true,
                allowBottomPadding: true,
                cardLayout: false
            });
            const elem = context.querySelector('#items')!;
            elem.innerHTML = html;
            imageLoader.lazyChildren(elem);
            userSettings.saveQuerySettings(getSavedQueryKey(), query as any);
            loading.hide();

            import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
                autoFocuser.autoFocus(context);
            });
        });
    }

    const data: Record<string, PageData> = {};

    this.getCurrentViewStyle = function () {
        return getPageData().view;
    };

    let promise: Promise<any>;

    this.preRender = function () {
        promise = getPromise();
    };

    this.renderTab = function () {
        reloadItems(tabContent, promise);
    };
}
