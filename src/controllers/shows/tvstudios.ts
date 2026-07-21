import loading from '../../components/loading/loading';
import cardBuilder from '../../components/cardbuilder/cardBuilder';

interface ViewParams {
    topParentId: string;
}

interface PageData {
    query: any;
}

const data: Record<string, PageData> = {};

function getQuery(params: ViewParams): any {
    const key = getSavedQueryKey(params);
    let pageData = data[key];

    if (!pageData) {
        pageData = data[key] = {
            query: {
                SortBy: 'SortName',
                SortOrder: 'Ascending',
                IncludeItemTypes: 'Series',
                Recursive: true,
                Fields: 'DateCreated,PrimaryImageAspectRatio',
                StartIndex: 0
            }
        };
        pageData.query.ParentId = params.topParentId;
    }

    return pageData.query;
}

function getSavedQueryKey(params: ViewParams): string {
    return `${params.topParentId}-studios`;
}

function getPromise(context: HTMLElement, params: ViewParams): Promise<any> {
    const query = getQuery(params);
    loading.show();
    return ApiClient.getStudios(ApiClient.getCurrentUserId(), query);
}

function reloadItems(context: HTMLElement, params: ViewParams, promise: Promise<any>): void {
    promise.then(function (result: any) {
        const elem = context.querySelector('#items');
        cardBuilder.buildCards(result.Items, {
            itemsContainer: elem,
            shape: 'backdrop',
            preferThumb: true,
            showTitle: true,
            scalable: true,
            centerText: true,
            overlayMoreButton: true,
            context: 'tvshows'
        });
        loading.hide();

        import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
            autoFocuser.autoFocus(context);
        });
    });
}

export default function (this: any, view: HTMLElement, params: ViewParams, tabContent: HTMLElement): void {
    let promise: Promise<any>;
    const self = this;

    self.preRender = function (): void {
        promise = getPromise(view, params);
    };

    self.renderTab = function (): void {
        reloadItems(tabContent, params, promise);
    };
}
