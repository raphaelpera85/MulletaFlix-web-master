import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import type { ApiClient } from 'jellyfin-apiclient';

import { getRecordingsQuery } from 'apps/stable/features/liveTv/api/useRecordings';
import cardBuilder from 'components/cardbuilder/cardBuilder';
import { appRouter } from 'components/router/appRouter';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { queryClient } from 'utils/query/queryClient';

import type { SectionContainerElement, SectionOptions } from './section';

function getLatestRecordingsFetchFn(
    serverId: string,
    activeRecordingsOnly: boolean,
    { enableOverflow }: SectionOptions
) {
    return function () {
        const apiClient = ServerConnections.getApiClient(serverId);
        return queryClient.fetchQuery(getRecordingsQuery(toApi(apiClient as any), {
            userId: apiClient.getCurrentUserId() ?? undefined,
            limit: enableOverflow ? 12 : 5,
            fields: [ ItemFields.PrimaryImageAspectRatio ],
            enableTotalRecordCount: false,
            isLibraryItem: activeRecordingsOnly ? undefined : false,
            isInProgress: activeRecordingsOnly ? true : undefined
        }));
    };
}

function getLatestRecordingItemsHtml(
    activeRecordingsOnly: boolean,
    { enableOverflow, featured, netflix }: SectionOptions & { featured?: boolean, netflix?: boolean }
) {
    return function (items: BaseItemDto[]) {
        const heroItem = featured && netflix ? items[0] : undefined;
        const heroHref = heroItem ? appRouter.getRouteUrl(heroItem, { serverId: heroItem.ServerId }) : undefined;
        const heroHtml = heroHref ? '<div class="netflixHeroActions"><a class="netflixHeroCta netflixHeroCta-primary" href="' + heroHref + '">WATCH</a></div>' : '';
        return cardBuilder.getCardsHtml({
            items: items,
            shape: featured && netflix ? 'banner' : (enableOverflow ? 'autooverflow' : 'auto'),
            showTitle: true,
            showParentTitle: true,
            coverImage: true,
            lazy: true,
            showDetailsMenu: true,
            centerText: true,
            overlayText: false,
            showYear: true,
            lines: 2,
            overlayPlayButton: !activeRecordingsOnly,
            allowBottomPadding: !enableOverflow,
            preferThumb: true,
            cardLayout: false,
            overlayMoreButton: activeRecordingsOnly,
            action: activeRecordingsOnly ? 'none' : null,
            centerPlayButton: activeRecordingsOnly
        }).replace(/^/, heroHtml);
    };
}

export function loadRecordings(
    elem: HTMLElement,
    activeRecordingsOnly: boolean,
    apiClient: ApiClient,
    options: SectionOptions & { featured?: boolean, netflix?: boolean }
) {
    const title = activeRecordingsOnly ?
        globalize.translate('HeaderActiveRecordings') :
        globalize.translate('HeaderLatestRecordings');

    let html = '';

    html += '<div class="sectionTitleContainer sectionTitleContainer-cards">';
    html += '<h2 class="sectionTitle sectionTitle-cards padded-left">' + title + '</h2>';
    html += '</div>';

    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x">';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer padded-left padded-right vertical-wrap focuscontainer-x">';
    }

    if (options.enableOverflow) {
        html += '</div>';
    }
    html += '</div>';

    elem.classList.add('hide');
    elem.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (!itemsContainer) return;
    itemsContainer.fetchData = getLatestRecordingsFetchFn(apiClient.serverId(), activeRecordingsOnly, options);
    itemsContainer.getItemsHtml = getLatestRecordingItemsHtml(activeRecordingsOnly, options);
    itemsContainer.parentContainer = elem;
}

