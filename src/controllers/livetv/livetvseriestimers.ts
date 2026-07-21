import cardBuilder from '../../components/cardbuilder/cardBuilder';
import imageLoader from '../../components/images/imageLoader';
import loading from '../../components/loading/loading';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-button/emby-button';

declare const ApiClient: {
    getLiveTvSeriesTimers(query: QueryParams): Promise<LiveTvSeriesTimersResponse>;
};

interface QueryParams {
    SortBy: string;
    SortOrder: string;
}

interface LiveTvSeriesTimersResponse {
    Items: any[];
}

interface CardBuilderGetCardsHtmlParams {
    items: any[];
    shape: string;
    defaultShape: string;
    showTitle: boolean;
    cardLayout: boolean;
    preferThumb: string;
    coverImage: boolean;
    overlayText: boolean;
    showSeriesTimerTime: boolean;
    showSeriesTimerChannel: boolean;
    centerText: boolean;
    overlayMoreButton: boolean;
    lines: number;
}

interface SeriesTimersController {
    preRender: () => void;
    renderTab: () => void;
}

function renderTimers(context: HTMLElement, timers: any[]): void {
    const html = (cardBuilder as any).getCardsHtml({
        items: timers,
        shape: 'auto',
        defaultShape: 'portrait',
        showTitle: true,
        cardLayout: false,
        preferThumb: 'auto',
        coverImage: true,
        overlayText: false,
        showSeriesTimerTime: true,
        showSeriesTimerChannel: true,
        centerText: true,
        overlayMoreButton: true,
        lines: 3
    } as CardBuilderGetCardsHtmlParams);
    const elem = context.querySelector('#items') as HTMLElement;
    elem.innerHTML = html;
    (imageLoader as any).lazyChildren(elem);
    (loading as any).hide();
}

function reload(context: HTMLElement, promise: Promise<LiveTvSeriesTimersResponse>): void {
    (loading as any).show();
    promise.then(function (result: LiveTvSeriesTimersResponse): void {
        renderTimers(context, result.Items);
    });
}

const query: QueryParams = {
    SortBy: 'SortName',
    SortOrder: 'Ascending'
};

export default function (this: SeriesTimersController, view: HTMLElement, params: Record<string, string>, tabContent: HTMLElement): void {
    let timersPromise: Promise<LiveTvSeriesTimersResponse>;
    const self = this;

    self.preRender = function (): void {
        timersPromise = ApiClient.getLiveTvSeriesTimers(query);
    };

    self.renderTab = function (): void {
        reload(tabContent, timersPromise);
    };
}
