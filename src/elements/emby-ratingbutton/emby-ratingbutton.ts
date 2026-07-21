import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import EmbyButtonPrototype from '../emby-button/emby-button';
import serverNotifications from 'scripts/serverNotifications';
import Events from 'utils/events';

interface UserData {
    Likes?: boolean | null;
    IsFavorite?: boolean;
}

function showPicker(button: HTMLElement, apiClient: any, itemId: string, likes: boolean | null, isFavorite: boolean): Promise<UserData> {
    return apiClient.updateFavoriteStatus(apiClient.getCurrentUserId(), itemId, !isFavorite);
}

function onClick(this: RatingButtonElement): void {
    const button = this;
    const id = button.getAttribute('data-id')!;
    const serverId = button.getAttribute('data-serverid')!;
    const apiClient = ServerConnections.getApiClient(serverId) as any;

    let likes: string | boolean | null = this.getAttribute('data-likes');
    const isFavorite: boolean = this.getAttribute('data-isfavorite') === 'true';
    if (likes === 'true') {
        likes = true;
    } else if (likes === 'false') {
        likes = false;
    } else {
        likes = null;
    }

    showPicker(button, apiClient, id, likes as boolean | null, isFavorite).then(function (userData: UserData) {
        setState(button, userData.Likes ?? null, userData.IsFavorite ?? false);
    });
}

interface UserDataChangedMessage {
    MessageType: string;
    Data?: {
        UserDataList?: Array<{ ItemId: string; Likes?: boolean | null; IsFavorite?: boolean }>;
    };
}

function onUserDataChanged({ MessageType, Data }: UserDataChangedMessage, apiClient: any, button: RatingButtonElement): void {
    const itemId = button.dataset.id;
    const userData = (Data?.UserDataList ?? []).find(u => u.ItemId === itemId);
    if (userData) {
        setState(button, userData.Likes ?? null, userData.IsFavorite ?? false);
    }
    Events.trigger(serverNotifications, MessageType, [apiClient, Data]);
}

function setState(button: RatingButtonElement, likes: boolean | null, isFavorite: boolean, updateAttribute?: boolean): void {
    const icon = button.querySelector('.material-icons') as HTMLElement | null;

    if (isFavorite) {
        if (icon) {
            icon.classList.add('favorite');
            icon.classList.add('ratingbutton-icon-withrating');
        }

        button.classList.add('ratingbutton-withrating');
    } else {
        if (icon) {
            icon.classList.add('favorite');
            icon.classList.remove('ratingbutton-icon-withrating');
        }
        button.classList.remove('ratingbutton-withrating');
    }

    if (updateAttribute !== false) {
        button.setAttribute('data-isfavorite', String(isFavorite));

        button.setAttribute('data-likes', (likes === null ? '' : String(likes)));
    }

    setTitle(button, isFavorite);
}

function setTitle(button: RatingButtonElement, isFavorite?: boolean): void {
    button.title = isFavorite ? globalize.translate('Favorite') : globalize.translate('AddToFavorites');

    const text = button.querySelector('.button-text') as HTMLElement | null;
    if (text) {
        text.innerText = button.title;
    }
}

function clearEvents(button: RatingButtonElement): void {
    button.removeEventListener('click', onClick as unknown as EventListener);
    button._unsubscribeUserData?.();
    button._unsubscribeUserData = null;
}

function bindEvents(button: RatingButtonElement): void {
    clearEvents(button);

    button.addEventListener('click', onClick as unknown as EventListener);

    const serverId = button.dataset.serverid!;
    const apiClient = ServerConnections.getApiClient(serverId) as any;
    button._unsubscribeUserData = apiClient?.subscribe(
        [OutboundWebSocketMessageType.UserDataChanged],
        (message: UserDataChangedMessage) => onUserDataChanged(message, apiClient, button)
    );
}

const EmbyRatingButtonPrototype: HTMLButtonElement = Object.create(EmbyButtonPrototype);

(EmbyRatingButtonPrototype as any).createdCallback = function (this: RatingButtonElement): void {
    // base method
    if ((EmbyButtonPrototype as any).createdCallback) {
        (EmbyButtonPrototype as any).createdCallback.call(this);
    }
};

(EmbyRatingButtonPrototype as any).attachedCallback = function (this: RatingButtonElement): void {
    // base method
    if ((EmbyButtonPrototype as any).attachedCallback) {
        (EmbyButtonPrototype as any).attachedCallback.call(this);
    }

    const itemId = this.getAttribute('data-id');
    const serverId = this.getAttribute('data-serverid');
    if (itemId && serverId) {
        let likes: string | boolean | null = this.getAttribute('data-likes');
        const isFavorite: boolean = this.getAttribute('data-isfavorite') === 'true';
        if (likes === 'true') {
            likes = true;
        } else if (likes === 'false') {
            likes = false;
        } else {
            likes = null;
        }

        setState(this, likes as boolean | null, isFavorite, false);
        bindEvents(this);
    } else {
        setTitle(this);
    }
};

(EmbyRatingButtonPrototype as any).detachedCallback = function (this: RatingButtonElement): void {
    // base method
    if ((EmbyButtonPrototype as any).detachedCallback) {
        (EmbyButtonPrototype as any).detachedCallback.call(this);
    }

    clearEvents(this);
};

(EmbyRatingButtonPrototype as any).setItem = function (this: RatingButtonElement, item?: { Id: string; ServerId: string; UserData?: UserData } | null): void {
    if (item) {
        this.setAttribute('data-id', item.Id);
        this.setAttribute('data-serverid', item.ServerId);

        const userData = item.UserData || {};
        setState(this, userData.Likes ?? null, userData.IsFavorite ?? false);
        bindEvents(this);
    } else {
        this.removeAttribute('data-id');
        this.removeAttribute('data-serverid');
        this.removeAttribute('data-likes');
        this.removeAttribute('data-isfavorite');
        clearEvents(this);
    }
};

interface RatingButtonElement extends HTMLButtonElement {
    _unsubscribeUserData?: (() => void) | null;
}

document.registerElement('emby-ratingbutton', {
    prototype: EmbyRatingButtonPrototype,
    extends: 'button'
});
