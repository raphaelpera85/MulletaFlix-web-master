import EmbyProgressRing from '../emby-progressring/emby-progressring';
import dom from '../../utils/dom';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';

import 'webcomponents.js/webcomponents-lite';

interface RefreshProgressInfo {
    ItemId?: string;
    Progress?: string | number;
}

interface RefreshProgressMessage {
    Data?: RefreshProgressInfo;
}

interface ItemRefreshIndicatorElement extends HTMLElement {
    itemId: string | null;
    _wsUnsubscribers: Array<() => void>;
    _wsApiClientCreatedHandler: ((e: unknown, newApiClient: { subscribe: (types: unknown[], handler: (msg: RefreshProgressMessage) => void) => (() => void) | null }) => void) | null;
}

function onRefreshProgress(indicator: ItemRefreshIndicatorElement, info: RefreshProgressInfo | undefined): void {
    if (!indicator.itemId) {
        indicator.itemId = dom.parentWithAttribute(indicator, 'data-id')!.getAttribute('data-id');
    }

    if (info?.ItemId === indicator.itemId) {
        const progress = parseFloat(String(info.Progress));

        if (progress && progress < 100) {
            indicator.classList.remove('hide');
        } else {
            indicator.classList.add('hide');
        }

        indicator.dataset.progress = String(progress);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EmbyItemRefreshIndicatorPrototype: any = Object.create(EmbyProgressRing);

EmbyItemRefreshIndicatorPrototype.createdCallback = function (): void {
    // base method
    if ((EmbyProgressRing as any).createdCallback) {
        (EmbyProgressRing as any).createdCallback.call(this);
    }

    const handler = ({ Data }: RefreshProgressMessage): void => onRefreshProgress(this, Data);

    this._wsApiClientCreatedHandler = (e: unknown, newApiClient: { subscribe: (types: unknown[], handler: (msg: RefreshProgressMessage) => void) => (() => void) | null }) => {
        const unsub = newApiClient.subscribe([OutboundWebSocketMessageType.RefreshProgress], handler);
        if (unsub) this._wsUnsubscribers.push(unsub);
    };

    this._wsUnsubscribers = ServerConnections.getApiClients()
        .map((apiClient: any) => apiClient.subscribe([OutboundWebSocketMessageType.RefreshProgress], handler))
        .filter(Boolean) as Array<() => void>;
};

EmbyItemRefreshIndicatorPrototype.attachedCallback = function (): void {
    // base method
    if ((EmbyProgressRing as any).attachedCallback) {
        (EmbyProgressRing as any).attachedCallback.call(this);
    }
};

EmbyItemRefreshIndicatorPrototype.detachedCallback = function (): void {
    // base method
    if ((EmbyProgressRing as any).detachedCallback) {
        (EmbyProgressRing as any).detachedCallback.call(this);
    }

    this._wsUnsubscribers?.forEach((unsub: () => void) => {
        unsub();
    });
    this._wsUnsubscribers = [];

    if (this._wsApiClientCreatedHandler) {
        this._wsApiClientCreatedHandler = null;
    }

    this.itemId = null;
};

document.registerElement('emby-itemrefreshindicator', {
    prototype: EmbyItemRefreshIndicatorPrototype,
    extends: 'div'
});
