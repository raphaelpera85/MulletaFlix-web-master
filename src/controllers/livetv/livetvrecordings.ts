import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getBackdropShape } from 'components/cardbuilder/utils/shape';
import imageLoader from 'components/images/imageLoader';
import loading from 'components/loading/loading';
import Dashboard from 'utils/dashboard';

import 'scripts/livetvcomponents';
import 'components/listview/listview.scss';
import 'elements/emby-itemscontainer/emby-itemscontainer';

declare const ApiClient: {
    serverId(): string;
    getLiveTvRecordings(options: {
        UserId: string;
        Limit: number;
        Fields: string;
        EnableTotalRecordCount: boolean;
        EnableImageTypes: string;
    }): Promise<{ Items: any[] }>;
    getRecordingFolders(userId: string): Promise<{ Items: any[] }>;
};

function renderRecordings(
    elem: HTMLElement | null,
    recordings: any[],
    cardOptions?: Record<string, unknown>,
    scrollX?: boolean
): void {
    if (!elem) {
        return;
    }

    if (recordings.length) {
        elem.classList.remove('hide');
    } else {
        elem.classList.add('hide');
    }

    const recordingItems = elem.querySelector('.recordingItems') as HTMLElement;

    if (scrollX) {
        recordingItems.classList.add('scrollX');
        recordingItems.classList.add('hiddenScrollX');
        recordingItems.classList.remove('vertical-wrap');
    } else {
        recordingItems.classList.remove('scrollX');
        recordingItems.classList.remove('hiddenScrollX');
        recordingItems.classList.add('vertical-wrap');
    }

    recordingItems.innerHTML = cardBuilder.getCardsHtml(Object.assign({
        items: recordings,
        shape: scrollX ? 'autooverflow' : 'auto',
        defaultShape: getBackdropShape(scrollX),
        showTitle: true,
        showParentTitle: true,
        coverImage: true,
        cardLayout: false,
        centerText: true,
        allowBottomPadding: !scrollX,
        preferThumb: 'auto',
        overlayText: false
    }, cardOptions || {}));
    imageLoader.lazyChildren(recordingItems);
}

function renderLatestRecordings(
    context: HTMLElement,
    promise: Promise<{ Items: any[] }>
): void {
    promise.then(function (result) {
        renderRecordings(context.querySelector('#latestRecordings'), result.Items, {
            showYear: true,
            lines: 2
        }, false);
        loading.hide();
    });
}

function renderRecordingFolders(
    context: HTMLElement,
    promise: Promise<{ Items: any[] }>
): void {
    promise.then(function (result) {
        renderRecordings(context.querySelector('#recordingFolders'), result.Items, {
            showYear: false,
            showParentTitle: false
        }, false);
    });
}

function onMoreClick(this: HTMLElement): void {
    const type = this.getAttribute('data-type');

    if (type === 'latest') {
        Dashboard.navigate('list?type=Recordings&serverId=' + ApiClient.serverId());
    }
}

interface LiveTvRecordingsController {
    preRender: () => void;
    renderTab: () => void;
}

export default function (this: LiveTvRecordingsController, view: HTMLElement, params: Record<string, string>, tabContent: HTMLElement): void {
    function enableFullRender(): boolean {
        return new Date().getTime() - lastFullRender > 300000;
    }

    let foldersPromise: Promise<{ Items: any[] }>;
    let latestPromise: Promise<{ Items: any[] }>;
    const self = this;
    let lastFullRender = 0;
    const moreButtons = tabContent.querySelectorAll('.more');

    for (let i = 0, length = moreButtons.length; i < length; i++) {
        moreButtons[i].addEventListener('click', function (this: HTMLElement) {
            onMoreClick.call(this);
        });
    }

    self.preRender = function (): void {
        const userId = Dashboard.getCurrentUserId() ?? '';
        if (enableFullRender()) {
            latestPromise = ApiClient.getLiveTvRecordings({
                UserId: userId,
                Limit: 12,
                Fields: 'CanDelete,PrimaryImageAspectRatio',
                EnableTotalRecordCount: false,
                EnableImageTypes: 'Primary,Thumb,Backdrop'
            });
            foldersPromise = ApiClient.getRecordingFolders(userId);
        }
    };

    self.renderTab = function (): void {
        if (enableFullRender()) {
            loading.show();
            renderLatestRecordings(tabContent, latestPromise);
            renderRecordingFolders(tabContent, foldersPromise);
            lastFullRender = new Date().getTime();
        }
    };
}
