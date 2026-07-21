import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getBackdropShape } from 'components/cardbuilder/utils/shape';
import imageLoader from 'components/images/imageLoader';
import layoutManager from 'components/layoutManager';
import loading from 'components/loading/loading';
import datetime from 'scripts/datetime';
import globalize from 'lib/globalize';

import 'elements/emby-itemscontainer/emby-itemscontainer';

import 'styles/scrollstyles.scss';

interface ViewParams {
    topParentId: string;
}

function getUpcomingPromise(context: HTMLElement, params: ViewParams): Promise<any> {
    loading.show();
    const query: any = {
        Limit: 48,
        Fields: 'AirTime',
        UserId: ApiClient.getCurrentUserId(),
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
        EnableTotalRecordCount: false
    };
    query.ParentId = params.topParentId;
    return ApiClient.getJSON(ApiClient.getUrl('Shows/Upcoming', query));
}

function loadUpcoming(context: HTMLElement, params: ViewParams, promise: Promise<any>): void {
    promise.then(function (result: any) {
        const items = result.Items;

        if (items.length) {
            (context.querySelector('.noItemsMessage') as HTMLElement).style.display = 'none';
        } else {
            (context.querySelector('.noItemsMessage') as HTMLElement).style.display = 'block';
        }

        renderUpcoming(context.querySelector('#upcomingItems') as HTMLElement, items);
        loading.hide();
    });
}

function enableScrollX(): boolean {
    return !layoutManager.desktop;
}

function renderUpcoming(elem: HTMLElement, items: any[]): void {
    const groups: { name: string; items: any[] }[] = [];
    let currentGroupName: string = '';
    let currentGroup: any[] = [];

    for (let i = 0, length = items.length; i < length; i++) {
        const item = items[i];
        let dateText = '';

        if (item.PremiereDate) {
            try {
                const premiereDate = datetime.parseISO8601Date(item.PremiereDate, true);
                dateText = datetime.isRelativeDay(premiereDate, -1) ? globalize.translate('Yesterday') : datetime.toLocaleDateString(premiereDate, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric'
                });
            } catch (err) {
                console.error('error parsing timestamp for upcoming tv shows', err);
            }
        }

        if (dateText != currentGroupName) {
            currentGroupName = dateText;
            currentGroup = [item];

            groups.push({
                name: currentGroupName,
                items: currentGroup
            });
        } else {
            currentGroup.push(item);
        }
    }

    let html = '';

    for (let i = 0, length = groups.length; i < length; i++) {
        const group = groups[i];
        html += '<div class="verticalSection">';
        html += '<h2 class="sectionTitle sectionTitle-cards padded-left">' + group.name + '</h2>';
        let allowBottomPadding = true;

        if (enableScrollX()) {
            allowBottomPadding = false;
            let scrollXClass = 'scrollX hiddenScrollX';

            if (layoutManager.tv) {
                scrollXClass += ' smoothScrollX';
            }

            html += '<div is="emby-itemscontainer" class="itemsContainer ' + scrollXClass + ' padded-left padded-right">';
        } else {
            html += '<div is="emby-itemscontainer" class="itemsContainer vertical-wrap padded-left padded-right">';
        }

        html += cardBuilder.getCardsHtml({
            items: group.items,
            showLocationTypeIndicator: false,
            shape: getBackdropShape(enableScrollX()),
            showTitle: true,
            preferThumb: true,
            lazy: true,
            showDetailsMenu: true,
            centerText: true,
            showParentTitle: true,
            overlayText: false,
            allowBottomPadding: allowBottomPadding,
            cardLayout: false,
            overlayMoreButton: true,
            missingIndicator: false
        });
        html += '</div>';
        html += '</div>';
    }

    elem.innerHTML = html;
    imageLoader.lazyChildren(elem);
}

export default function (this: any, view: HTMLElement, params: ViewParams, tabContent: HTMLElement): void {
    let upcomingPromise: Promise<any>;
    const self = this;

    self.preRender = function (): void {
        upcomingPromise = getUpcomingPromise(view, params);
    };

    self.renderTab = function (): void {
        loadUpcoming(tabContent, params, upcomingPromise);
    };
}
