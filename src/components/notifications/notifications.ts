import { playbackManager } from '../playback/playbackmanager';
import Events from '../../utils/events.ts';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { getItems } from '../../utils/jellyfin-apiclient/getItems.ts';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import type { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client';
import type { ApiClient as JellyfinApiClient } from 'jellyfin-apiclient';

import NotificationIcon from './notificationicon.png';

interface NotificationServerInfo {
    Id: string;
    Name: string;
}

type CurrentApiClient = NonNullable<ReturnType<typeof ServerConnections.currentApiClient>>;

interface NotificationsApiClient {
    getCurrentUserId(): string;
    getCurrentUser(): Promise<UserDto>;
    serverInfo(): NotificationServerInfo;
    getScaledImageUrl(itemId: string, options?: { width?: number; tag?: string; type?: string }): string;
    subscribe<TData = unknown>(
        messageTypes: OutboundWebSocketMessageType[],
        onMessage: (event: { Data: TData }) => void
    ): { close: () => void };
}

interface NotificationAction {
    action: string;
    title: string;
    icon: string;
}

interface AppNotificationData {
    serverId?: string;
    id?: string;
}

interface AppNotificationOptions {
    title?: string;
    actions?: NotificationAction[];
    data: AppNotificationData;
    vibrate?: boolean;
    body?: string;
    tag?: string;
    icon?: string;
    badge?: string;
}

interface ClosableNotification {
    close?: () => void;
    cancel?: () => void;
    show?: () => void;
}

interface LibraryChangedData {
    ItemsAdded?: string[];
}

interface PackageInstallationInfo {
    Id: string;
    id?: string;
    Name: string;
    Version: string;
    PercentComplete?: number;
}

type PackageInstallationStatus = 'completed' | 'cancelled' | 'failed' | 'progress';

interface NotificationItem {
    Id: string;
    Name: string;
    Type?: BaseItemKind;
    SeriesName?: string;
    ImageTags?: {
        Primary?: string;
    };
}

function onOneDocumentClick(): void {
    document.removeEventListener('click', onOneDocumentClick);
    document.removeEventListener('keydown', onOneDocumentClick);

    // don't request notification permissions if they're already granted or denied
    if (window.Notification && window.Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function registerOneDocumentClickHandler(): void {
    Events.off(ServerConnections, 'localusersignedin', registerOneDocumentClickHandler);

    document.addEventListener('click', onOneDocumentClick);
    document.addEventListener('keydown', onOneDocumentClick);
}

function initPermissionRequest(): void {
    const apiClient = ServerConnections.currentApiClient() as unknown as NotificationsApiClient | undefined;
    if (apiClient) {
        apiClient.getCurrentUser()
            .then(() => registerOneDocumentClickHandler())
            .catch(() => {
                Events.on(ServerConnections, 'localusersignedin', registerOneDocumentClickHandler);
            });
    } else {
        registerOneDocumentClickHandler();
    }
}

initPermissionRequest();

let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;

function closeAfter(notification: ClosableNotification, timeoutMs: number): void {
    setTimeout(function () {
        if (notification.close) {
            notification.close();
        } else if (notification.cancel) {
            notification.cancel();
        }
    }, timeoutMs);
}

function resetRegistration(): void {
    /* eslint-disable-next-line compat/compat */
    const serviceWorker = navigator.serviceWorker;
    if (serviceWorker) {
        serviceWorker.ready.then(function (registration) {
            serviceWorkerRegistration = registration;
        });
    }
}

resetRegistration();

function showPersistentNotification(title: string, options: AppNotificationOptions): void {
    serviceWorkerRegistration?.showNotification(title, options);
}

function showNonPersistentNotification(title: string, options: AppNotificationOptions, timeoutMs: number): void {
    try {
        const notif = new Notification(title, options) as Notification & ClosableNotification;

        if (notif.show) {
            notif.show();
        }

        if (timeoutMs) {
            closeAfter(notif, timeoutMs);
        }
    } catch (err) {
        if (options.actions) {
            options.actions = [];
            showNonPersistentNotification(title, options, timeoutMs);
        } else {
            throw err;
        }
    }
}

function showNotification(options: AppNotificationOptions, timeoutMs: number, apiClient: NotificationsApiClient): void {
    if (!window.Notification || Notification.permission !== 'granted') {
        return;
    }

    const title = options.title || '';

    options.data = options.data || {};
    options.data.serverId = apiClient.serverInfo().Id;
    options.icon = options.icon || NotificationIcon;
    options.badge = options.badge || NotificationIcon;

    resetRegistration();

    if (serviceWorkerRegistration) {
        showPersistentNotification(title, options);
        return;
    }

    showNonPersistentNotification(title, options, timeoutMs);
}

function showNewItemNotification(item: NotificationItem, apiClient: NotificationsApiClient): void {
    if (playbackManager.isPlayingLocally(['Video'])) {
        return;
    }

    let body = item.Name;

    if (item.SeriesName) {
        body = item.SeriesName + ' - ' + body;
    }

    const notification: AppNotificationOptions = {
        title: 'New ' + item.Type,
        body: body,
        vibrate: true,
        tag: 'newItem' + item.Id,
        data: {}
    };

    const imageTags = item.ImageTags || {};

    if (imageTags.Primary) {
        notification.icon = apiClient.getScaledImageUrl(item.Id, {
            width: 80,
            tag: imageTags.Primary,
            type: 'Primary'
        });
    }

    showNotification(notification, 15000, apiClient);
}

function onLibraryChanged(data: LibraryChangedData, apiClient: NotificationsApiClient): void {
    const newItems = data.ItemsAdded ?? [];

    if (!newItems.length) {
        return;
    }

    // Don't put a massive number of Id's onto the query string
    if (newItems.length > 12) {
        newItems.length = 12;
    }

    const query = {
        Recursive: true,
        Limit: 3,
        Filters: 'IsNotFolder',
        SortBy: 'DateCreated',
        SortOrder: 'Descending',
        Ids: newItems.join(','),
        MediaTypes: 'Audio,Video',
        EnableTotalRecordCount: false
    };

    getItems(apiClient as unknown as JellyfinApiClient, apiClient.getCurrentUserId(), query).then(function (result) {
        const items = (result.Items ?? []) as NotificationItem[];

        for (const item of items) {
            showNewItemNotification(item, apiClient);
        }
    });
}

function showPackageInstallNotification(apiClient: NotificationsApiClient, installation: PackageInstallationInfo, status: PackageInstallationStatus): void {
    apiClient.getCurrentUser().then(function (user: UserDto) {
        const adminUser = user as UserDto & { Policy: { IsAdministrator: boolean } };

        if (!adminUser.Policy.IsAdministrator) {
            return;
        }

        const notification: AppNotificationOptions = {
            tag: 'install' + installation.Id,
            data: {}
        };

        if (status === 'completed') {
            notification.title = globalize.translate('PackageInstallCompleted', installation.Name, installation.Version);
            notification.vibrate = true;
        } else if (status === 'cancelled') {
            notification.title = globalize.translate('PackageInstallCancelled', installation.Name, installation.Version);
        } else if (status === 'failed') {
            notification.title = globalize.translate('PackageInstallFailed', installation.Name, installation.Version);
            notification.vibrate = true;
        } else if (status === 'progress') {
            notification.title = globalize.translate('InstallingPackage', installation.Name, installation.Version);

            notification.actions =
                [
                    {
                        action: 'cancel-install',
                        title: globalize.translate('ButtonCancel'),
                        icon: NotificationIcon
                    }
                ];

            notification.data.id = installation.id;
        }

        if (status === 'progress') {
            const percentComplete = Math.round(installation.PercentComplete || 0);

            notification.body = percentComplete + '% complete.';
        }

        const timeout = status === 'cancelled' ? 5000 : 0;

        showNotification(notification, timeout, apiClient);
    });
}

function subscribeToApiClient(apiClient: NotificationsApiClient): void {
    const notificationsApiClient = apiClient;

    notificationsApiClient.subscribe<LibraryChangedData>([OutboundWebSocketMessageType.LibraryChanged], ({ Data }) => {
        onLibraryChanged(Data, apiClient);
    });

    notificationsApiClient.subscribe<PackageInstallationInfo>([OutboundWebSocketMessageType.PackageInstallationCompleted], ({ Data }) => {
        showPackageInstallNotification(apiClient, Data, 'completed');
    });

    notificationsApiClient.subscribe<PackageInstallationInfo>([OutboundWebSocketMessageType.PackageInstallationFailed], ({ Data }) => {
        showPackageInstallNotification(apiClient, Data, 'failed');
    });

    notificationsApiClient.subscribe<PackageInstallationInfo>([OutboundWebSocketMessageType.PackageInstallationCancelled], ({ Data }) => {
        showPackageInstallNotification(apiClient, Data, 'cancelled');
    });

    notificationsApiClient.subscribe<PackageInstallationInfo>([OutboundWebSocketMessageType.PackageInstalling], ({ Data }) => {
        showPackageInstallNotification(apiClient, Data, 'progress');
    });

    notificationsApiClient.subscribe([OutboundWebSocketMessageType.ServerShuttingDown], () => {
        const serverId = apiClient.serverInfo().Id;
        const notification: AppNotificationOptions = {
            tag: 'restart' + serverId,
            title: globalize.translate('ServerNameIsShuttingDown', apiClient.serverInfo().Name),
            data: {}
        };
        showNotification(notification, 0, apiClient);
    });

    notificationsApiClient.subscribe([OutboundWebSocketMessageType.ServerRestarting], () => {
        const serverId = apiClient.serverInfo().Id;
        const notification: AppNotificationOptions = {
            tag: 'restart' + serverId,
            title: globalize.translate('ServerNameIsRestarting', apiClient.serverInfo().Name),
            data: {}
        };
        showNotification(notification, 0, apiClient);
    });

    notificationsApiClient.subscribe([OutboundWebSocketMessageType.RestartRequired], () => {
        const serverId = apiClient.serverInfo().Id;
        const notification: AppNotificationOptions = {
            tag: 'restart' + serverId,
            title: globalize.translate('PleaseRestartServerName', apiClient.serverInfo().Name),
            data: {}
        };

        notification.actions =
            [
                {
                    action: 'restart',
                    title: globalize.translate('Restart'),
                    icon: NotificationIcon
                }
            ];

        showNotification(notification, 0, apiClient);
    });
}

ServerConnections.getApiClients().forEach(function (apiClient) {
    subscribeToApiClient(apiClient as unknown as NotificationsApiClient);
});
Events.on(ServerConnections, 'apiclientcreated', (_e: unknown, newApiClient: NotificationsApiClient) => subscribeToApiClient(newApiClient));
