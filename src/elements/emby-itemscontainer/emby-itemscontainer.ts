import 'webcomponents.js/webcomponents-lite';
import Sortable from 'sortablejs';

import itemShortcuts from '../../components/shortcuts';
import inputManager from '../../scripts/inputManager';
import { playbackManager } from '../../components/playback/playbackmanager';
import imageLoader from '../../components/images/imageLoader';
import layoutManager from '../../components/layoutManager';
import browser from '../../scripts/browser';
import dom from '../../utils/dom';
import loading from '../../components/loading/loading';
import focusManager from '../../components/focusManager';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';

const ItemsContainerPrototype: HTMLDivElement = Object.create(HTMLDivElement.prototype);

function onClick(this: ItemsContainerElement, e: MouseEvent): void {
    const itemsContainer = this;
    const multiSelect = itemsContainer.multiSelect;

    if (multiSelect?.onContainerClick.call(itemsContainer, e) === false) {
        return;
    }

    itemShortcuts.onClick.call(itemsContainer, e);
}

function disableEvent(e: Event): false {
    e.preventDefault();
    e.stopPropagation();
    return false;
}

function onContextMenu(this: ItemsContainerElement, e: MouseEvent): false | undefined {
    const target = e.target as HTMLElement;
    const card = dom.parentWithAttribute(target, 'data-id');

    // check for serverId, it won't be present on selectserver
    if (card?.getAttribute('data-serverid')) {
        inputManager.handleCommand('menu', {
            sourceElement: card
        });

        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

function getShortcutOptions(): { click: boolean } {
    return {
        click: false
    };
}

(ItemsContainerPrototype as any).enableMultiSelect = function (this: ItemsContainerElement, enabled: boolean): void {
    const current = this.multiSelect;

    if (!enabled) {
        if (current) {
            current.destroy();
            this.multiSelect = null;
        }
        return;
    }

    if (current) {
        return;
    }

    const self = this;
    import('../../components/multiSelect/multiSelect').then(({ default: MultiSelect }) => {
        self.multiSelect = new MultiSelect({
            container: self,
            bindOnClick: false
        });
    });
};

function onDrop(evt: Sortable.SortableEvent, itemsContainer: ItemsContainerElement): void {
    const el = evt.item;

    const newIndex: number = evt.newIndex!;
    const itemId = el.getAttribute('data-playlistitemid');
    const playlistId = el.getAttribute('data-playlistid');

    if (!playlistId) {
        const oldIndex: number = evt.oldIndex!;
        el.dispatchEvent(new CustomEvent('itemdrop', {
            detail: {
                oldIndex: oldIndex,
                newIndex: newIndex,
                playlistItemId: itemId
            },
            bubbles: true,
            cancelable: false
        }));
        return;
    }

    const serverId = el.getAttribute('data-serverid')!;
    const apiClient = ServerConnections.getApiClient(serverId) as any;

    loading.show();

    apiClient.ajax({
        url: apiClient.getUrl('Playlists/' + playlistId + '/Items/' + itemId + '/Move/' + newIndex),
        type: 'POST'
    }).then(function () {
        loading.hide();
    }, function () {
        loading.hide();
        itemsContainer.refreshItems();
    });
}

(ItemsContainerPrototype as any).enableDragReordering = function (this: ItemsContainerElement, enabled: boolean): void {
    const current = this.sortable;
    if (!enabled) {
        if (current) {
            current.destroy();
            this.sortable = null;
        }
        return;
    }

    if (current) {
        return;
    }

    const self = this;
    self.sortable = new Sortable(self, {
        draggable: '.listItem',
        handle: '.listViewDragHandle',

        // dragging ended
        onEnd: function (evt: Sortable.SortableEvent) {
            return onDrop(evt, self);
        }
    });
};

interface UserDataMessage {
    Data?: {
        UserDataList?: Array<{ ItemId: string; Likes?: boolean | null; IsFavorite?: boolean }>;
    };
}

function onUserDataChanged({ Data }: UserDataMessage, itemsContainer: ItemsContainerElement): void {
    import('../../components/cardbuilder/cardBuilder').then((cardBuilder) => {
        for (const userData of Data?.UserDataList ?? []) {
            cardBuilder.onUserDataChanged(userData, itemsContainer);
        }
    });

    const eventsToMonitor: string[] = getEventsToMonitor(itemsContainer);

    // TODO: Check user data change reason?
    if (eventsToMonitor.indexOf('markfavorite') !== -1
            || eventsToMonitor.indexOf('markplayed') !== -1
    ) {
        itemsContainer.notifyRefreshNeeded();
    }
}

function getEventsToMonitor(itemsContainer: ItemsContainerElement): string[] {
    const monitor = itemsContainer.getAttribute('data-monitor');
    if (monitor) {
        return monitor.split(',');
    }

    return [];
}

interface TimerMessage {
    Data?: {
        ProgramId?: string;
        Id?: string;
    };
}

function onTimerCreated({ Data }: TimerMessage, itemsContainer: ItemsContainerElement): void {
    if (getEventsToMonitor(itemsContainer).indexOf('timers') !== -1) {
        itemsContainer.notifyRefreshNeeded();
        return;
    }

    const programId: string | undefined = Data?.ProgramId;
    // This could be null, not supported by all tv providers
    const newTimerId: string | undefined = Data?.Id;

    import('../../components/cardbuilder/cardBuilder').then((cardBuilder) => {
        cardBuilder.onTimerCreated(programId as string, newTimerId as string, itemsContainer);
    });
}

function onSeriesTimerCreated(_: unknown, itemsContainer: ItemsContainerElement): void {
    if (getEventsToMonitor(itemsContainer).indexOf('seriestimers') !== -1) {
        itemsContainer.notifyRefreshNeeded();
    }
}

function onTimerCancelled({ Data }: TimerMessage, itemsContainer: ItemsContainerElement): void {
    if (getEventsToMonitor(itemsContainer).indexOf('timers') !== -1) {
        itemsContainer.notifyRefreshNeeded();
        return;
    }

    import('../../components/cardbuilder/cardBuilder').then((cardBuilder) => {
        cardBuilder.onTimerCancelled(Data?.Id as string ?? '', itemsContainer);
    });
}

function onSeriesTimerCancelled({ Data }: TimerMessage, itemsContainer: ItemsContainerElement): void {
    if (getEventsToMonitor(itemsContainer).indexOf('seriestimers') !== -1) {
        itemsContainer.notifyRefreshNeeded();
        return;
    }

    import('../../components/cardbuilder/cardBuilder').then((cardBuilder) => {
        cardBuilder.onSeriesTimerCancelled(Data?.Id as string ?? '', itemsContainer);
    });
}

interface LibraryChangedMessage {
    Data?: {
        ItemsAdded?: string[];
        ItemsRemoved?: string[];
        FoldersAddedTo?: string[];
        FoldersRemovedFrom?: string[];
        CollectionFolders?: string[];
    };
}

function onLibraryChanged({ Data }: LibraryChangedMessage, itemsContainer: ItemsContainerElement): void {
    const eventsToMonitor: string[] = getEventsToMonitor(itemsContainer);
    if (eventsToMonitor.indexOf('seriestimers') !== -1 || eventsToMonitor.indexOf('timers') !== -1) {
        // yes this is an assumption
        return;
    }

    const itemsAdded: string[] = Data?.ItemsAdded ?? [];
    const itemsRemoved: string[] = Data?.ItemsRemoved ?? [];
    if (!itemsAdded.length && !itemsRemoved.length) {
        return;
    }

    const parentId = itemsContainer.getAttribute('data-parentid');
    if (parentId) {
        const foldersAddedTo: string[] = Data?.FoldersAddedTo ?? [];
        const foldersRemovedFrom: string[] = Data?.FoldersRemovedFrom ?? [];
        const collectionFolders: string[] = Data?.CollectionFolders ?? [];

        if (foldersAddedTo.indexOf(parentId) === -1 && foldersRemovedFrom.indexOf(parentId) === -1 && collectionFolders.indexOf(parentId) === -1) {
            return;
        }
    }

    itemsContainer.notifyRefreshNeeded();
}

function onPlaybackStopped(this: ItemsContainerElement, e: unknown, stopInfo: { state: { NowPlayingItem?: { MediaType: string } } }): void {
    const itemsContainer = this;
    const state = stopInfo.state;

    const eventsToMonitor: string[] = getEventsToMonitor(itemsContainer);
    if (state.NowPlayingItem && state.NowPlayingItem.MediaType === 'Video') {
        if (eventsToMonitor.indexOf('videoplayback') !== -1) {
            itemsContainer.notifyRefreshNeeded(true);
            return;
        }
    } else if (state.NowPlayingItem?.MediaType === 'Audio' && eventsToMonitor.indexOf('audioplayback') !== -1) {
        itemsContainer.notifyRefreshNeeded(true);
        return;
    }
}

function addNotificationEvent(instance: ItemsContainerElement, name: string, handler: Function, owner: any): void {
    const localHandler = handler.bind(instance);
    Events.on(owner, name, localHandler);
    (instance as any)['event_' + name] = localHandler;
}

function removeNotificationEvent(instance: ItemsContainerElement, name: string, owner: any): void {
    const handler = (instance as any)['event_' + name];
    if (handler) {
        Events.off(owner, name, handler);
        (instance as any)['event_' + name] = null;
    }
}

(ItemsContainerPrototype as any).createdCallback = function (this: ItemsContainerElement): void {
    this.classList.add('itemsContainer');
};

(ItemsContainerPrototype as any).attachedCallback = function (this: ItemsContainerElement): void {
    this.addEventListener('click', onClick as unknown as EventListener);

    if (browser.touch) {
        this.addEventListener('contextmenu', disableEvent as unknown as EventListener);
    } else if (this.getAttribute('data-contextmenu') !== 'false') {
        this.addEventListener('contextmenu', onContextMenu as unknown as EventListener);
    }

    if (layoutManager.desktop || layoutManager.mobile && this.getAttribute('data-multiselect') !== 'false') {
        this.enableMultiSelect(true);
    }

    if (layoutManager.tv) {
        this.classList.add('itemsContainer-tv');
    }

    itemShortcuts.on(this, getShortcutOptions());

    const subscribeToApiClient = (apiClient: any) => [
        apiClient.subscribe([OutboundWebSocketMessageType.UserDataChanged], (msg: UserDataMessage) => onUserDataChanged(msg, this)),
        apiClient.subscribe([OutboundWebSocketMessageType.TimerCreated], (msg: TimerMessage) => onTimerCreated(msg, this)),
        apiClient.subscribe([OutboundWebSocketMessageType.SeriesTimerCreated], (msg: unknown) => onSeriesTimerCreated(msg, this)),
        apiClient.subscribe([OutboundWebSocketMessageType.TimerCancelled], (msg: TimerMessage) => onTimerCancelled(msg, this)),
        apiClient.subscribe([OutboundWebSocketMessageType.SeriesTimerCancelled], (msg: TimerMessage) => onSeriesTimerCancelled(msg, this)),
        apiClient.subscribe([OutboundWebSocketMessageType.LibraryChanged], (msg: LibraryChangedMessage) => onLibraryChanged(msg, this))
    ].filter(Boolean);

    this._wsApiClientCreatedHandler = (e: unknown, newApiClient: any) => {
        this._wsUnsubscribers = (this._wsUnsubscribers ?? []).concat(subscribeToApiClient(newApiClient));
    };
    this._wsUnsubscribers = ServerConnections.getApiClients().flatMap(subscribeToApiClient);

    addNotificationEvent(this, 'playbackstop', onPlaybackStopped, playbackManager);

    if (this.getAttribute('data-dragreorder') === 'true') {
        this.enableDragReordering(true);
    }
};

(ItemsContainerPrototype as any).detachedCallback = function (this: ItemsContainerElement): void {
    clearRefreshInterval(this);

    this.enableMultiSelect(false);
    this.enableDragReordering(false);
    this.removeEventListener('click', onClick as unknown as EventListener);
    this.removeEventListener('contextmenu', onContextMenu as unknown as EventListener);
    this.removeEventListener('contextmenu', disableEvent as unknown as EventListener);

    itemShortcuts.off(this, getShortcutOptions());

    this._wsUnsubscribers?.forEach((unsub: () => void) => {
        unsub();
    });
    this._wsUnsubscribers = [];
    if (this._wsApiClientCreatedHandler) {
        this._wsApiClientCreatedHandler = null;
    }

    removeNotificationEvent(this, 'playbackstop', playbackManager);

    this.fetchData = null;
    this.getItemsHtml = null;
    this.parentContainer = null;
};

(ItemsContainerPrototype as any).pause = function (this: ItemsContainerElement): void {
    clearRefreshInterval(this, true);
    this.paused = true;
};

(ItemsContainerPrototype as any).resume = function (this: ItemsContainerElement, options?: { refresh?: boolean }): Promise<void> {
    this.paused = false;

    const refreshIntervalEndTime = this.refreshIntervalEndTime;
    if (refreshIntervalEndTime) {
        const remainingMs: number = refreshIntervalEndTime - new Date().getTime();
        if (remainingMs > 0 && !this.needsRefresh) {
            resetRefreshInterval(this, remainingMs);
        } else {
            this.needsRefresh = true;
            this.refreshIntervalEndTime = null;
        }
    }

    if (this.needsRefresh || (options?.refresh)) {
        return this.refreshItems();
    }

    return Promise.resolve();
};

(ItemsContainerPrototype as any).refreshItems = function (this: ItemsContainerElement): Promise<void> {
    if (!this.fetchData || !this.getItemsHtml) {
        return Promise.resolve();
    }

    if (this.paused) {
        this.needsRefresh = true;
        return Promise.resolve();
    }

    this.needsRefresh = false;

    return this.fetchData().then(onDataFetched.bind(this));
};

(ItemsContainerPrototype as any).notifyRefreshNeeded = function (this: ItemsContainerElement, isInForeground?: boolean): void {
    if (this.paused) {
        this.needsRefresh = true;
        return;
    }

    const timeout = this.refreshTimeout;
    if (timeout) {
        clearTimeout(timeout);
    }

    if (isInForeground === true) {
        this.refreshItems();
    } else {
        this.refreshTimeout = setTimeout(this.refreshItems.bind(this), 10000) as unknown as number;
    }
};

function clearRefreshInterval(itemsContainer: ItemsContainerElement, isPausing?: boolean): void {
    if (itemsContainer.refreshInterval) {
        clearInterval(itemsContainer.refreshInterval);
        itemsContainer.refreshInterval = null;

        if (!isPausing) {
            itemsContainer.refreshIntervalEndTime = null;
        }
    }
}

function resetRefreshInterval(itemsContainer: ItemsContainerElement, intervalMs?: number): void {
    clearRefreshInterval(itemsContainer);

    if (!intervalMs) {
        intervalMs = parseInt(itemsContainer.getAttribute('data-refreshinterval') || '0', 10);
    }

    if (intervalMs) {
        itemsContainer.refreshInterval = setInterval(itemsContainer.notifyRefreshNeeded.bind(itemsContainer), intervalMs) as unknown as number;
        itemsContainer.refreshIntervalEndTime = new Date().getTime() + intervalMs;
    }
}

function onDataFetched(this: ItemsContainerElement, result: any): void {
    const items = result.Items || result;

    const parentContainer = this.parentContainer;
    if (parentContainer) {
        if (items.length) {
            parentContainer.classList.remove('hide');
        } else {
            parentContainer.classList.add('hide');
        }
    }

    const activeElement = document.activeElement as HTMLElement | null;
    let focusId: string | null | undefined;
    let hasActiveElement: boolean | undefined;

    if (this.contains(activeElement)) {
        hasActiveElement = true;
        focusId = activeElement!.getAttribute('data-id');
    }

    if (this.getItemsHtml) {
        this.innerHTML = this.getItemsHtml(items);
    }

    imageLoader.lazyChildren(this);
    reloadParentScroller(this);

    if (hasActiveElement) {
        setFocus(this, focusId);
    }

    resetRefreshInterval(this);

    if (this.afterRefresh) {
        this.afterRefresh(result);
    }
}

function reloadParentScroller(itemsContainer: ItemsContainerElement): void {
    const scroller = itemsContainer.closest('.emby-scroller') as (HTMLElement & { scroller?: { reload: () => void } }) | null;
    if (!scroller?.scroller) {
        return;
    }

    window.requestAnimationFrame(() => {
        scroller.scroller?.reload();
    });
}

function setFocus(itemsContainer: ItemsContainerElement, focusId: string | null | undefined): void {
    if (focusId) {
        const newElement = itemsContainer.querySelector('[data-id="' + focusId + '"]');
        if (newElement) {
            try {
                focusManager.focus(newElement);
                return;
            } catch (err) {
                console.error(err);
            }
        }
    }

    focusManager.autoFocus(itemsContainer);
}

interface ItemsContainerElement extends HTMLDivElement {
    multiSelect?: any;
    sortable?: Sortable | null;
    _wsUnsubscribers?: Array<() => void>;
    _wsApiClientCreatedHandler?: ((e: unknown, apiClient: any) => void) | null;
    enableMultiSelect(enabled: boolean): void;
    enableDragReordering(enabled: boolean): void;
    refreshItems(): Promise<void>;
    notifyRefreshNeeded(isInForeground?: boolean): void;
    pause(): void;
    resume(options?: { refresh?: boolean }): Promise<void>;
    fetchData?: (() => Promise<any>) | null;
    getItemsHtml?: ((items: any[]) => string) | null;
    parentContainer?: HTMLElement | null;
    afterRefresh?: (result: any) => void;
    paused?: boolean;
    needsRefresh?: boolean;
    refreshInterval?: number | null;
    refreshIntervalEndTime?: number | null;
    refreshTimeout?: number | null;
}

declare var Events: {
    on(owner: any, name: string, handler: Function): void;
    off(owner: any, name: string, handler: Function): void;
};

document.registerElement('emby-itemscontainer', {
    prototype: ItemsContainerPrototype,
    extends: 'div'
});
