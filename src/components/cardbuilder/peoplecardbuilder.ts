/**
 * Module for building cards from item data.
 * @module components/cardBuilder/peoplecardbuilder
 */

import cardBuilder from './cardBuilder';

type CardItem = Record<string, string | number | boolean | null | undefined>;

interface PeopleCardOptions {
    cardLayout?: boolean;
    centerText?: boolean;
    showTitle?: boolean;
    cardFooterAside?: string;
    showPersonRoleOrType?: boolean;
    cardCssClass?: string;
    defaultCardImageIcon?: string;
    [key: string]: string | number | boolean | null | undefined;
}

export function buildPeopleCards(items: CardItem[], options?: PeopleCardOptions): void {
    const mergedOptions = Object.assign(options || {}, {
        cardLayout: false,
        centerText: true,
        showTitle: true,
        cardFooterAside: 'none',
        showPersonRoleOrType: true,
        cardCssClass: 'personCard',
        defaultCardImageIcon: 'person'
    });

    cardBuilder.buildCards(items, mergedOptions);
}

export default {
    buildPeopleCards
};
