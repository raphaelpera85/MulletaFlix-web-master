import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getBackdropShape } from 'components/cardbuilder/utils/shape';
import imageLoader from 'components/images/imageLoader';
import layoutManager from 'components/layoutManager';
import loading from 'components/loading/loading';
import { getTimersHtml } from 'scripts/livetvcomponents';
import Dashboard from 'utils/dashboard';

import 'elements/emby-button/emby-button';
import 'elements/emby-itemscontainer/emby-itemscontainer';

declare const ApiClient: any;

function enableScrollX(): boolean {
    return !layoutManager.desktop;
}

function renderRecordings(elem: HTMLElement, recordings: any[], cardOptions?: Record<string, any>): void {
    if (recordings.length) {
        elem.classList.remove('hide');
    } else {
        elem.classList.add('hide');
    }

    const recordingItems = elem.querySelector('.recordingItems') as HTMLElement;

    if (enableScrollX()) {
        recordingItems.classList.add('scrollX');

        if (layoutManager.tv) {
            recordingItems.classList.add('smoothScrollX');
        }

        recordingItems.classList.add('hiddenScrollX');
        recordingItems.classList.remove('vertical-wrap');
    } else {
        recordingItems.classList.remove('scrollX');
        recordingItems.classList.remove('smoothScrollX');
        recordingItems.classList.remove('hiddenScrollX');
        recordingItems.classList.add('vertical-wrap');
    }

    recordingItems.innerHTML = cardBuilder.getCardsHtml(Object.assign({
        items: recordings,
        shape: enableScrollX() ? 'autooverflow' : 'auto',
        showTitle: true,
        showParentTitle: true,
        coverImage: true,
        cardLayout: false,
        centerText: true,
        allowBottomPadding: !enableScrollX(),
        preferThumb: 'auto'
    }, cardOptions || {}));
    imageLoader.lazyChildren(recordingItems);
}

function renderActiveRecordings(context: HTMLElement, promise: Promise<any>): void {
    promise.then(function (result: any) {
        renderRecordings(context.querySelector('#activeRecordings') as HTMLElement, result.Items, {
            shape: enableScrollX() ? 'autooverflow' : 'auto',
            defaultShape: getBackdropShape(enableScrollX()),
            showParentTitle: false,
            showParentTitleOrTitle: true,
            showTitle: true,
            showAirTime: true,
            showAirEndTime: true,
            showChannelName: true,
            coverImage: true,
            overlayText: false,
            overlayMoreButton: true
        });
    });
}

function renderTimers(context: HTMLElement, timers: any[], options?: Record<string, any>): void {
    getTimersHtml(timers, options).then(function (html: string) {
        const elem = context;

        if (html) {
            elem.classList.remove('hide');
        } else {
            elem.classList.add('hide');
        }

        (elem.querySelector('.recordingItems') as HTMLElement).innerHTML = html;
        imageLoader.lazyChildren(elem);
    });
}

function renderUpcomingRecordings(context: HTMLElement, promise: Promise<any>): void {
    promise.then(function (result: any) {
        renderTimers(context.querySelector('#upcomingRecordings') as HTMLElement, result.Items);
        loading.hide();
    });
}

export default function (this: any, view: any, params: any, tabContent: HTMLElement): void {
    let activeRecordingsPromise: Promise<any>;
    let upcomingRecordingsPromise: Promise<any>;
    const self = this;
    tabContent.querySelector('#upcomingRecordings .recordingItems')!.addEventListener('timercancelled', function () {
        self.preRender();
        self.renderTab();
    });

    self.preRender = function () {
        activeRecordingsPromise = ApiClient.getLiveTvRecordings({
            UserId: Dashboard.getCurrentUserId(),
            IsInProgress: true,
            Fields: 'CanDelete,PrimaryImageAspectRatio',
            EnableTotalRecordCount: false,
            EnableImageTypes: 'Primary,Thumb,Backdrop'
        });
        upcomingRecordingsPromise = ApiClient.getLiveTvTimers({
            IsActive: false,
            IsScheduled: true
        });
    };

    self.renderTab = function () {
        loading.show();
        renderActiveRecordings(tabContent, activeRecordingsPromise);
        renderUpcomingRecordings(tabContent, upcomingRecordingsPromise);
    };
}
