import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import EmbyButtonPrototype from '../../elements/emby-button/emby-button';

interface UserDataItem {
    ItemId: string;
    Played: boolean;
}

interface UserDataChangedMessage {
    Data?: {
        UserDataList?: UserDataItem[];
    };
}

interface ItemData {
    Id: string;
    ServerId: string;
    Type: string;
    UserData?: {
        Played: boolean;
    };
}

interface PlaystateButtonElement extends HTMLButtonElement {
    iconElement: HTMLElement | null;
    _unsubscribeUserData: (() => void) | null;
}

function onClick(this: PlaystateButtonElement): void {
    const button = this;
    const id = button.getAttribute('data-id')!;
    const serverId = button.getAttribute('data-serverid')!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiClient: any = ServerConnections.getApiClient(serverId);

    if (!button.classList.contains('playstatebutton-played')) {
        apiClient.markPlayed(apiClient.getCurrentUserId(), id, new Date());
        setState(button, true);
    } else {
        apiClient.markUnplayed(apiClient.getCurrentUserId(), id, new Date());
        setState(button, false);
    }
}

function onUserDataChanged({ Data }: UserDataChangedMessage, button: PlaystateButtonElement): void {
    const itemId = button.dataset.id;
    const userData = (Data?.UserDataList ?? []).find(u => u.ItemId === itemId);
    if (userData) {
        setState(button, userData.Played);
    }
}

function setState(button: PlaystateButtonElement, played: boolean, updateAttribute?: boolean): void {
    let icon = button.iconElement;
    if (!icon) {
        button.iconElement = button.querySelector('.material-icons');
        icon = button.iconElement;
    }

    if (played) {
        button.classList.add('playstatebutton-played');
        if (icon) {
            icon.classList.add('playstatebutton-icon-played');
            icon.classList.remove('playstatebutton-icon-unplayed');
        }
    } else {
        button.classList.remove('playstatebutton-played');
        if (icon) {
            icon.classList.remove('playstatebutton-icon-played');
            icon.classList.add('playstatebutton-icon-unplayed');
        }
    }

    if (updateAttribute !== false) {
        button.setAttribute('data-played', String(played));
    }

    setTitle(button, button.getAttribute('data-type'), played);
}

function setTitle(button: PlaystateButtonElement, itemType: string | null, played: boolean): void {
    if (itemType !== 'AudioBook') {
        button.title = played ? globalize.translate('Watched') : globalize.translate('MarkPlayed');
    } else {
        button.title = played ? globalize.translate('Played') : globalize.translate('MarkPlayed');
    }

    const text = button.querySelector('.button-text') as HTMLElement | null;
    if (text) {
        text.innerText = button.title;
    }
}

function clearEvents(button: PlaystateButtonElement): void {
    button.removeEventListener('click', onClick as EventListener);
    button._unsubscribeUserData?.();
    button._unsubscribeUserData = null;
}

function bindEvents(button: PlaystateButtonElement): void {
    clearEvents(button);

    button.addEventListener('click', onClick as EventListener);
    const serverId = button.dataset.serverid!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiClient: any = ServerConnections.getApiClient(serverId);
    button._unsubscribeUserData = apiClient?.subscribe(
        [OutboundWebSocketMessageType.UserDataChanged],
        (msg: UserDataChangedMessage) => onUserDataChanged(msg, button)
    );
}

const EmbyPlaystateButtonPrototype = Object.create(EmbyButtonPrototype);

EmbyPlaystateButtonPrototype.createdCallback = function (): void {
    // base method
    if (EmbyButtonPrototype.createdCallback) {
        EmbyButtonPrototype.createdCallback.call(this);
    }
};

EmbyPlaystateButtonPrototype.attachedCallback = function (): void {
    // base method
    if (EmbyButtonPrototype.attachedCallback) {
        EmbyButtonPrototype.attachedCallback.call(this);
    }

    const itemId = this.getAttribute('data-id');
    const serverId = this.getAttribute('data-serverid');
    if (itemId && serverId) {
        setState(this, this.getAttribute('data-played') === 'true', false);
        bindEvents(this);
    }
};

EmbyPlaystateButtonPrototype.detachedCallback = function (): void {
    // base method
    if (EmbyButtonPrototype.detachedCallback) {
        EmbyButtonPrototype.detachedCallback.call(this);
    }

    clearEvents(this);
    this.iconElement = null;
};

EmbyPlaystateButtonPrototype.setItem = function (item: ItemData | null): void {
    if (item) {
        this.setAttribute('data-id', item.Id);
        this.setAttribute('data-serverid', item.ServerId);
        this.setAttribute('data-type', item.Type);

        const played = item.UserData?.Played ?? false;
        setState(this, played);
        bindEvents(this);
    } else {
        this.removeAttribute('data-id');
        this.removeAttribute('data-serverid');
        this.removeAttribute('data-type');
        this.removeAttribute('data-played');
        clearEvents(this);
    }
};

document.registerElement('emby-playstatebutton', {
    prototype: EmbyPlaystateButtonPrototype,
    extends: 'button'
});
