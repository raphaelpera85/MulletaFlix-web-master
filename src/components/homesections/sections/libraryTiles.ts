import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getBackdropShape } from 'components/cardbuilder/utils/shape';
import { appRouter } from 'components/router/appRouter';
import imageLoader from 'components/images/imageLoader';
import globalize from 'lib/globalize';

import type { SectionOptions } from './section';

export function loadLibraryTiles(
    elem: HTMLElement,
    userViews: BaseItemDto[],
    {
        enableOverflow,
        featured,
        netflix
    }: SectionOptions & { featured?: boolean, netflix?: boolean }
) {
    let html = '';
    if (userViews.length) {
        const heroHref = featured && netflix ? userViews[0] ? appRouter.getRouteUrl(userViews[0], { serverId: userViews[0].ServerId }) : undefined : undefined;
        html += '<h2 class="sectionTitle sectionTitle-cards padded-left">' + globalize.translate('HeaderMyMedia') + '</h2>';
        if (heroHref) {
            html += '<div class="netflixHeroActions"><a class="netflixHeroCta netflixHeroCta-primary" href="' + heroHref + '">BROWSE</a></div>';
        }
        if (enableOverflow) {
            html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
            html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x">';
        } else {
            html += '<div is="emby-itemscontainer" class="itemsContainer padded-left padded-right focuscontainer-x vertical-wrap">';
        }

        html += cardBuilder.getCardsHtml({
            items: userViews,
            shape: featured && netflix ? 'banner' : getBackdropShape(enableOverflow),
            showTitle: true,
            centerText: true,
            overlayText: false,
            lazy: true,
            transition: false,
            allowBottomPadding: !enableOverflow
        });

        if (enableOverflow) {
            html += '</div>';
        }
        html += '</div>';
    }

    elem.innerHTML = html;
    imageLoader.lazyChildren(elem);
}

