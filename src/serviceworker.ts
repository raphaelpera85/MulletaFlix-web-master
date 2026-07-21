interface ServiceWorkerNotificationData {
    serverId?: string;
    id?: string;
}

type ServiceWorkerAction = 'cancel-install' | 'restart';

interface WindowClient {
}

interface ServiceWorkerScope {
    addEventListener(type: 'notificationclick', listener: (event: ServiceWorkerNotificationClickEvent) => void, options?: boolean): void;
    addEventListener(type: 'activate', listener: () => void, options?: boolean): void;
    clients: {
        openWindow(url: string): Promise<WindowClient | null>;
        claim(): Promise<void>;
    };
}

interface ServiceWorkerNotificationClickEvent {
    notification: Notification & { data?: ServiceWorkerNotificationData };
    action: string;
    waitUntil(promise: Promise<unknown>): void;
}

function getApiClient(serverId: string | undefined): Promise<unknown> {
    return Promise.resolve((globalThis as unknown as { connectionManager: { getApiClient(serverId?: string): unknown } }).connectionManager.getApiClient(serverId));
}

function executeAction(action: ServiceWorkerAction, data: ServiceWorkerNotificationData, serverId: string | undefined): Promise<void> {
    return getApiClient(serverId).then((apiClient) => {
        const client = apiClient as {
            cancelPackageInstallation(id: string | undefined): Promise<unknown>;
            restartServer(): Promise<unknown>;
        };

        switch (action) {
            case 'cancel-install':
                return client.cancelPackageInstallation(data.id).then(() => undefined);
            case 'restart':
                return client.restartServer().then(() => undefined);
            default:
                return (self as unknown as ServiceWorkerScope).clients.openWindow('/').then(() => undefined);
        }
    });
}

/* eslint-disable-next-line no-restricted-globals -- self is valid in a serviceworker environment */
const serviceWorker = self as unknown as ServiceWorkerScope;

serviceWorker.addEventListener('notificationclick', (event: ServiceWorkerNotificationClickEvent) => {
    const notification = event.notification;
    notification.close();

    const data = notification.data as ServiceWorkerNotificationData;
    const serverId = data.serverId;
    const action = event.action as ServiceWorkerAction | '';

    if (!action) {
        (self as unknown as ServiceWorkerScope).clients.openWindow('/');
        event.waitUntil(Promise.resolve());
        return;
    }

    event.waitUntil(executeAction(action, data, serverId));
}, false);

/* eslint-disable-next-line no-restricted-globals -- self is valid in a serviceworker environment */
serviceWorker.addEventListener('activate', () => serviceWorker.clients.claim());
