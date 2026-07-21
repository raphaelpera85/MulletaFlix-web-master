import { Credentials } from 'jellyfin-apiclient';

import { appHost } from 'components/apphost';
import appSettings from 'scripts/settings/appSettings';
import { setUserInfo } from 'scripts/settings/userSettings';
import { detectBitrate } from 'utils/bitrateTest';
import Dashboard from 'utils/dashboard';
import Events from 'utils/events';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { createApiClient } from 'utils/jellyfin-apiclient/createApiClient';

import ConnectionManager from './connectionManager';
import { ConnectOptions, ConnectResult, LocalUser } from './connectionManager';
import { ConnectionState } from './connectionState';

const credentialProvider = new Credentials();
const capabilities = Dashboard.capabilities(appHost);

interface ImageOptions {
    quality?: number;
    maxWidth?: number;
    width?: number;
    maxHeight?: number;
    height?: number;
    fillWidth?: number;
    fillHeight?: number;
    [key: string]: unknown;
}

const normalizeImageOptions = (options: ImageOptions): void => {
    if (!options.quality && (options.maxWidth || options.width || options.maxHeight || options.height || options.fillWidth || options.fillHeight)) {
        options.quality = 90;
    }
};

const getMaxBandwidth = (): number | null => {
    const conn = (navigator as unknown as { connection?: { downlinkMax?: number } }).connection;
    if (conn) {
        let max = conn.downlinkMax;
        if (max && max > 0 && max < Number.POSITIVE_INFINITY) {
            max /= 8;
            max *= 1000000;
            max *= 0.7;
            return parseInt(String(max), 10);
        }
    }

    return null;
};

interface ServerInfo {
    Id?: string;
    [key: string]: unknown;
}

interface ApiClient {
    serverAddress(): string;
    accessToken(): string;
    subscribe?(messageTypes: unknown[], onMessage: unknown, subscriptionIntervals: unknown): { close: () => void };
    [key: string]: unknown;
}

class ServerConnections extends ConnectionManager {
    firstConnection = false;
    localApiClient: ApiClient | null = null;

    constructor() {
        super(
            credentialProvider,
            () => appHost.appName(),
            () => appHost.appVersion(),
            () => appHost.deviceName(),
            () => appHost.deviceId(),
            capabilities
        );
        this.localApiClient = null;
        this.firstConnection = null as unknown as boolean;

        Events.on(this, 'localusersignedout', (_e: unknown, logoutInfo: unknown) => {
            setUserInfo(undefined, undefined as unknown as never);
            // Ensure the updated credentials are persisted to storage
            const creds = this.credentialProvider();
            creds.credentials(creds.credentials());

            if (window.NativeShell && typeof window.NativeShell.onLocalUserSignedOut === 'function') {
                window.NativeShell.onLocalUserSignedOut(logoutInfo);
            }
        });

        Events.on(this, 'apiclientcreated', (_e: unknown, apiClient: ApiClient) => {
            apiClient.getMaxBandwidth = getMaxBandwidth;
            apiClient.normalizeImageOptions = normalizeImageOptions;

            // Bridge the SDK websocket subscribe API onto the legacy ApiClient.
            // The SDK Api is lazily created on first use so the access token is available.
            let _sdkApi: ReturnType<typeof toApi> | null = null;
            apiClient.subscribe = (messageTypes: unknown[], onMessage: unknown, subscriptionIntervals: unknown) => {
                const serverUrl = apiClient.serverAddress();
                if (!serverUrl) {
                    console.warn('Cannot subscribe: apiClient serverAddress is not set yet.');
                    return {
                        close: () => {}
                    };
                }
                if (!_sdkApi) {
                    _sdkApi = toApi(apiClient as never);
                }

                // Keep the SDK Api's access token in sync with the legacy client.
                // The first subscribe call may happen before authentication completes
                // (e.g. from notifications.js at module load time), leaving _sdkApi
                // with no token and a WebSocket that never connects. Calling update()
                // triggers WebSocketService.updateUrl() which reconnects automatically.
                const accessToken = apiClient.accessToken();
                if (accessToken && (_sdkApi as unknown as { accessToken?: string }).accessToken !== accessToken) {
                    (_sdkApi as unknown as { update: (opts: { accessToken: string }) => void }).update({ accessToken });
                }

                return (_sdkApi as unknown as { subscribe: (messageTypes: unknown[], onMessage: unknown, subscriptionIntervals: unknown) => { close: () => void } }).subscribe(messageTypes, onMessage, subscriptionIntervals);
            };
        });
    }

    initApiClient(server: string): void {
        console.debug('creating ApiClient singleton');

        const apiClient = createApiClient(
            server,
            appHost.appName(),
            appHost.appVersion(),
            appHost.deviceName(),
            appHost.deviceId()
        );

        (apiClient as unknown as { enableAutomaticNetworking: boolean }).enableAutomaticNetworking = false;
        (apiClient as unknown as { manualAddressOnly: boolean }).manualAddressOnly = true;

        this.addApiClient(apiClient as never);

        this.setLocalApiClient(apiClient as unknown as ApiClient);

        console.debug('loaded ApiClient singleton');
    }

    /**
     * @returns {Promise<ConnectResponse>} The result of the connection attempt.
     */
    override connect(options?: ConnectOptions): Promise<ConnectResult> {
        return super.connect({
            enableAutoLogin: appSettings.enableAutoLogin(),
            ...options
        }) as unknown as Promise<ConnectResult>;
    }

    setLocalApiClient(apiClient: ApiClient): void {
        if (apiClient) {
            this.localApiClient = apiClient;
            (window as unknown as { ApiClient: ApiClient }).ApiClient = apiClient;
        }
    }

    getLocalApiClient(): ApiClient | null {
        return this.localApiClient;
    }

    /**
     * Gets the ApiClient that is currently connected.
     * @returns {ApiClient|undefined} apiClient
     */
    currentApiClient(): ApiClient | undefined {
        let apiClient = this.getLocalApiClient() || undefined;

        if (!apiClient) {
            const server = this.getLastUsedServer();

            if (server) {
                apiClient = this.getApiClient(server.Id!) as unknown as ApiClient;
            }
        }

        return apiClient;
    }

    /**
     * Gets the Api that is currently connected.
     * @returns The current Api instance.
     */
    getCurrentApi(): ReturnType<typeof toApi> | undefined {
        const apiClient = this.currentApiClient();
        if (!apiClient) return;

        return toApi(apiClient as never);
    }

    /**
     * Gets the ApiClient that is currently connected or throws if not defined.
     * @async
     * @returns {Promise<ApiClient>} The current ApiClient instance.
     */
    async getCurrentApiClientAsync(): Promise<ApiClient> {
        const apiClient = this.currentApiClient();
        if (!apiClient) throw new Error('[ServerConnection] No current ApiClient instance');

        return apiClient;
    }

    override onLocalUserSignedIn = (user: LocalUser): Promise<void> => {
        const apiClient = this.getApiClient(user.ServerId!);
        this.setLocalApiClient(apiClient as unknown as ApiClient);
        setTimeout(() => detectBitrate(toApi(apiClient as never), true), 6000);
        return setUserInfo(user.Id, apiClient as never).then(() => {
            if (window.NativeShell && typeof window.NativeShell.onLocalUserSignedIn === 'function') {
                return window.NativeShell.onLocalUserSignedIn(user, (apiClient as unknown as ApiClient).accessToken());
            }
            return Promise.resolve();
        });
    }
}

export default new ServerConnections();
