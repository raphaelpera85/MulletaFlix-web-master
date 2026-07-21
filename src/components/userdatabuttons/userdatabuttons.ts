import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import dom from '../../utils/dom';
import itemHelper from '../itemHelper';

import '../../elements/emby-button/paper-icon-button-light';
import 'material-design-icons-iconfont';
import '../../elements/emby-button/emby-button';
import './userdatabuttons.scss';

interface UserData {
    Played?: boolean;
    IsFavorite?: boolean;
    [key: string]: unknown;
}

interface Item {
    Id?: string;
    ServerId?: string;
    UserData?: UserData;
    Type?: string;
    [key: string]: unknown;
}

interface Classes {
    buttonCssClass: string;
    iconCssClass?: string;
}

interface UserDataButtonsOptions {
    item: Item;
    includePlayed?: boolean;
    cssClass?: string;
    style?: string;
    iconCssClass?: string;
    element?: HTMLElement;
    fillMode?: string;
    insertLocation?: string;
    [key: string]: unknown;
}

interface UserDataMethods {
    markPlayed: (link: HTMLElement) => void;
    markFavorite: (link: HTMLElement) => void;
    [key: string]: (link: HTMLElement) => void;
}

const userDataMethods: UserDataMethods = {
    markPlayed: markPlayed,
    markFavorite: markFavorite
};

function getUserDataButtonHtml(method: string, itemId: string | undefined, serverId: string | undefined, icon: string, tooltip: string, style: string | undefined, classes: Classes): string {
    let buttonCssClass = classes.buttonCssClass;
    let iconCssClass = classes.iconCssClass;

    if (style === 'fab-mini') {
        style = 'fab';
        buttonCssClass = buttonCssClass ? (buttonCssClass + ' mini') : 'mini';
    }

    const is = style === 'fab' ? 'emby-button' : 'paper-icon-button-light';
    let className = style === 'fab' ? 'autoSize fab' : 'autoSize';

    if (buttonCssClass) {
        className += ' ' + buttonCssClass;
    }

    if (iconCssClass) {
        iconCssClass += ' ';
    } else {
        iconCssClass = '';
    }

    iconCssClass += 'material-icons';

    return `<button title="${tooltip}" data-itemid="${itemId}" data-serverid="${serverId}" is="${is}" data-method="${method}" class="${className}"><span class="${iconCssClass} ${icon}" aria-hidden="true"></span></button>`;
}

function onContainerClick(e: Event): void {
    const target = (e as MouseEvent).target as HTMLElement;
    const btnUserData = dom.parentWithClass(target, 'btnUserData');

    if (!btnUserData) {
        return;
    }

    const method = btnUserData.getAttribute('data-method')!;
    userDataMethods[method](btnUserData);
}

function fill(options: UserDataButtonsOptions): void {
    const html = getIconsHtml(options);

    if (options.fillMode === 'insertAdjacent') {
        options.element?.insertAdjacentHTML((options.insertLocation || 'beforeend') as InsertPosition, html);
    } else {
        if (options.element) {
            options.element.innerHTML = html;
        }
    }

    if (options.element) {
        dom.removeEventListener(options.element, 'click', onContainerClick, {
            passive: true
        });

        dom.addEventListener(options.element, 'click', onContainerClick, {
            passive: true
        });
    }
}

function destroy(options: UserDataButtonsOptions): void {
    if (options.element) {
        options.element.innerHTML = '';

        dom.removeEventListener(options.element, 'click', onContainerClick, {
            passive: true
        });
    }
}

function getIconsHtml(options: UserDataButtonsOptions): string {
    const item = options.item;
    const includePlayed = options.includePlayed;
    const cssClass = options.cssClass;
    const style = options.style;

    let html = '';

    const userData = item.UserData || {};

    const itemId = item.Id;

    if (itemHelper.isLocalItem(item)) {
        return html;
    }

    let btnCssClass = 'btnUserData';

    if (cssClass) {
        btnCssClass += ' ' + cssClass;
    }

    const iconCssClass = options.iconCssClass;
    const classes: Classes = { buttonCssClass: btnCssClass, iconCssClass: iconCssClass };
    const serverId = item.ServerId;

    if (includePlayed !== false) {
        const tooltipPlayed = globalize.translate('MarkPlayed');

        if (itemHelper.canMarkPlayed(item)) {
            if (userData.Played) {
                const buttonCssClass = classes.buttonCssClass + ' btnUserDataOn';
                html += getUserDataButtonHtml('markPlayed', itemId, serverId, 'check', tooltipPlayed, style, { buttonCssClass, iconCssClass: classes.iconCssClass });
            } else {
                html += getUserDataButtonHtml('markPlayed', itemId, serverId, 'check', tooltipPlayed, style, classes);
            }
        }
    }

    const tooltipFavorite = globalize.translate('Favorite');
    if (userData.IsFavorite) {
        const buttonCssClass = classes.buttonCssClass + ' btnUserData btnUserDataOn';
        html += getUserDataButtonHtml('markFavorite', itemId, serverId, 'favorite', tooltipFavorite, style, { buttonCssClass, iconCssClass: classes.iconCssClass });
    } else {
        classes.buttonCssClass += ' btnUserData';
        html += getUserDataButtonHtml('markFavorite', itemId, serverId, 'favorite', tooltipFavorite, style, classes);
    }

    return html;
}

function markFavorite(link: HTMLElement): void {
    const id = link.getAttribute('data-itemid')!;
    const serverId = link.getAttribute('data-serverid')!;

    const markAsFavorite = !link.classList.contains('btnUserDataOn');

    favorite(id, serverId, markAsFavorite);

    if (markAsFavorite) {
        link.classList.add('btnUserDataOn');
    } else {
        link.classList.remove('btnUserDataOn');
    }
}

function markPlayed(link: HTMLElement): void {
    const id = link.getAttribute('data-itemid')!;
    const serverId = link.getAttribute('data-serverid')!;

    if (!link.classList.contains('btnUserDataOn')) {
        played(id, serverId, true);

        link.classList.add('btnUserDataOn');
    } else {
        played(id, serverId, false);

        link.classList.remove('btnUserDataOn');
    }
}

function played(id: string, serverId: string, isPlayed: boolean): Promise<void> {
    const apiClient = ServerConnections.getApiClient(serverId) as any;

    const method = isPlayed ? 'markPlayed' : 'markUnplayed';

    return apiClient[method](apiClient.getCurrentUserId(), id, new Date());
}

function favorite(id: string, serverId: string, isFavorite: boolean): Promise<void> {
    const apiClient = ServerConnections.getApiClient(serverId) as any;

    return apiClient.updateFavoriteStatus(apiClient.getCurrentUserId(), id, isFavorite);
}

export default {
    fill: fill,
    destroy: destroy,
    getIconsHtml: getIconsHtml
};
