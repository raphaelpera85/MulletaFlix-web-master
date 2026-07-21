import { AUTHORIZATION_HEADER } from '@jellyfin/sdk/lib/constants';
import { getAuthorizationHeader } from '@jellyfin/sdk/lib/utils';
import { MINIMUM_VERSION } from '@jellyfin/sdk/lib/versions';

import events from 'utils/events';
import { ajax } from 'utils/fetch';
import { createApiClient } from 'utils/jellyfin-apiclient/createApiClient';
import { equalsIgnoreCase } from 'utils/string';
import { compareVersions } from 'utils/versions';

import { ConnectionMode } from './connectionMode';
import { ConnectionState } from './connectionState';

const DEFAULT_CONNECTION_TIMEOUT = 20000;

interface ServerInfo {
    Id?: string;
    Name?: string;
    LocalAddress?: string;
    ManualAddress?: string;
    RemoteAddress?: string;
    DateLastAccessed?: number;
    LastConnectionMode?: number;
    UserId?: string | null;
    AccessToken?: string | null;
    ExchangeToken?: string | null;
    manualAddressOnly?: boolean;
    ConnectServerId?: string;
    UserLinkType?: string;
    [key: string]: unknown;
}

interface SystemInfo {
    ServerName?: string;
    Id?: string;
    LocalAddress?: string;
    Version?: string;
    [key: string]: unknown;
}

interface CredentialProvider {
    credentials(data?: { Servers: ServerInfo[] }): { Servers: ServerInfo[] };
    addOrUpdateServer(servers: ServerInfo[], server: ServerInfo): void;
}

interface ApiClient {
    serverAddress(): string;
    serverInfo(info?: ServerInfo): ServerInfo;
    onAuthenticated?: (instance: ApiClient, result: AuthResult) => void;
    manualAddressOnly?: boolean;
    enableAutomaticBitrateDetection?: boolean;
    setAuthenticationInfo(accessToken: string | null, userId: string | null): void;
    setSystemInfo(systemInfo: SystemInfo): void;
    updateServerInfo(server: ServerInfo, serverUrl: string): void;
    getCurrentUserId(): string | null;
    getCurrentUser(): Promise<LocalUser>;
    getUserImageUrl(userId: string, options: { tag: string; type: string }): string;
    reportCapabilities(capabilities: unknown): void;
    logout(): Promise<void>;
    accessToken(): string | null;
    handleMessageReceived(msg: { ServerId?: string; Data?: string | object; [key: string]: unknown }): void;
    [key: string]: unknown;
}

interface AuthResult {
    ServerId: string;
    User: LocalUser;
    AccessToken: string;
    [key: string]: unknown;
}

export interface LocalUser {
    Id: string;
    Name?: string;
    PrimaryImageTag?: string;
    ServerId?: string;
    [key: string]: unknown;
}

export interface ConnectResult {
    Servers?: ServerInfo[];
    State?: ConnectionState;
    ApiClient?: ApiClient;
    SystemInfo?: SystemInfo;
}

function getServerAddress(server: ServerInfo, mode: number): string | undefined {
    switch (mode) {
        case ConnectionMode.Local:
            return server.LocalAddress;
        case ConnectionMode.Manual:
            return server.ManualAddress;
        case ConnectionMode.Remote:
            return server.RemoteAddress;
        default:
            return server.ManualAddress || server.LocalAddress || server.RemoteAddress;
    }
}

function updateServerInfo(server: ServerInfo, systemInfo: SystemInfo): void {
    server.Name = systemInfo.ServerName;

    if (systemInfo.Id) {
        server.Id = systemInfo.Id;
    }

    if (systemInfo.LocalAddress) {
        server.LocalAddress = systemInfo.LocalAddress;
    }
}

function normalizeAddress(address: string): string {
    // Attempt to correct bad input
    address = address.trim();

    // Seeing failures in iOS when protocol isn't lowercase
    address = address.replace('Http:', 'http:');
    address = address.replace('Https:', 'https:');

    return address;
}

function sortByAccess(a: ServerInfo, b: ServerInfo): number {
    return (b.DateLastAccessed || 0) - (a.DateLastAccessed || 0);
}

export default class ConnectionManager {
    _apiClients!: ApiClient[];
    _minServerVersion!: string;

    appVersion!: () => string;
    appName!: () => string;
    capabilities!: () => unknown;
    deviceName!: () => string;
    deviceId!: () => string;
    credentialProvider!: () => CredentialProvider;
    getServerInfo!: (id: string) => ServerInfo | undefined;
    getLastUsedServer!: () => ServerInfo | null;
    addApiClient!: (apiClient: ApiClient) => void;
    clearData!: () => void;
    _getOrAddApiClient!: (server: ServerInfo, serverUrl: string | undefined) => ApiClient;
    getOrCreateApiClient!: (serverId: string) => ApiClient;
    user!: (apiClient: ApiClient) => Promise<{ localUser: LocalUser | undefined; name: string | null; imageUrl: string | null; supportsImageParams: boolean }>;
    logout!: () => Promise<void>;
    getSavedServers!: () => ServerInfo[];
    getAvailableServers!: () => Promise<ServerInfo[]>;
    connectToServers!: (servers: ServerInfo[], options?: ConnectOptions) => Promise<ConnectResult>;
    connectToServer!: (server: ServerInfo, options?: ConnectOptions) => Promise<ConnectResult>;
    updateSavedServerId!: (server: ServerInfo) => Promise<void>;
    connectToAddress!: (address: string, options?: ConnectOptions) => Promise<ConnectResult>;
    deleteServer!: (serverId: string) => Promise<void>;
    onLocalUserSignedIn?: (user: LocalUser) => Promise<void>;

    constructor(
        credentialProvider: CredentialProvider,
        appName: string | (() => string),
        appVersion: string | (() => string),
        deviceName: string | (() => string),
        deviceId: string | (() => string),
        capabilities: unknown
    ) {
        console.debug('Begin ConnectionManager constructor');

        const self = this;
        this._apiClients = [];

        // Set the minimum version to match the SDK
        self._minServerVersion = MINIMUM_VERSION;

        self.appVersion = () => typeof appVersion === 'function' ? appVersion() : appVersion;

        self.appName = () => typeof appName === 'function' ? appName() : appName;

        self.capabilities = () => capabilities;

        self.deviceName = () => typeof deviceName === 'function' ? deviceName() : deviceName;

        self.deviceId = () => typeof deviceId === 'function' ? deviceId() : deviceId;

        self.credentialProvider = () => credentialProvider;

        self.getServerInfo = (id: string) => {
            const servers = credentialProvider.credentials().Servers;

            return servers.filter((s: ServerInfo) => s.Id === id)[0];
        };

        self.getLastUsedServer = () => {
            const servers = credentialProvider.credentials().Servers;

            servers.sort(sortByAccess);

            if (!servers.length) {
                return null;
            }

            return servers[0];
        };

        self.addApiClient = (apiClient: ApiClient) => {
            self._apiClients.push(apiClient);

            const existingServers = credentialProvider
                .credentials()
                .Servers.filter(
                    (s: ServerInfo) =>
                        equalsIgnoreCase(s.ManualAddress || '', apiClient.serverAddress())
                        || equalsIgnoreCase(s.LocalAddress || '', apiClient.serverAddress())
                        || equalsIgnoreCase(s.RemoteAddress || '', apiClient.serverAddress())
                );

            const existingServer = existingServers.length ? existingServers[0] : apiClient.serverInfo();
            existingServer.DateLastAccessed = new Date().getTime();
            existingServer.LastConnectionMode = ConnectionMode.Manual;
            existingServer.ManualAddress = apiClient.serverAddress();

            if (apiClient.manualAddressOnly) {
                existingServer.manualAddressOnly = true;
            }

            apiClient.serverInfo(existingServer);

            apiClient.onAuthenticated = (instance: ApiClient, result: AuthResult) => onAuthenticated(instance, result, {}, true);

            if (!existingServers.length) {
                const credentials = credentialProvider.credentials();
                credentials.Servers = [existingServer];
                credentialProvider.credentials(credentials);
            }

            events.trigger(self, 'apiclientcreated', [apiClient]);
        };

        self.clearData = () => {
            console.debug('connection manager clearing data');

            const credentials = credentialProvider.credentials();
            credentials.Servers = [];
            credentialProvider.credentials(credentials);
        };

        self._getOrAddApiClient = (server: ServerInfo, serverUrl: string | undefined) => {
            let apiClient = self.getApiClient(server.Id!);

            if (!apiClient) {
                apiClient = createApiClient(serverUrl!, self.appName(), self.appVersion(), self.deviceName(), self.deviceId()) as unknown as ApiClient;

                self._apiClients.push(apiClient);

                apiClient.serverInfo(server);

                apiClient.onAuthenticated = (instance: ApiClient, result: AuthResult) => {
                    return onAuthenticated(instance, result, {}, true);
                };

                events.trigger(self, 'apiclientcreated', [apiClient]);
            }

            console.debug('returning instance from getOrAddApiClient');
            return apiClient;
        };

        self.getOrCreateApiClient = (serverId: string) => {
            const credentials = credentialProvider.credentials();
            const servers = credentials.Servers.filter((s: ServerInfo) => equalsIgnoreCase(s.Id || '', serverId));

            if (!servers.length) {
                throw new Error(`Server not found: ${serverId}`);
            }

            const server = servers[0];

            return self._getOrAddApiClient(server, getServerAddress(server, server.LastConnectionMode || 0));
        };

        function onAuthenticated(apiClient: ApiClient, result: AuthResult, options: { updateDateLastAccessed?: boolean; [key: string]: unknown }, saveCredentials: boolean): Promise<void> {
            const credentials = credentialProvider.credentials();
            const servers = credentials.Servers.filter((s: ServerInfo) => s.Id === result.ServerId);

            const server = servers.length ? servers[0] : apiClient.serverInfo();

            if (options.updateDateLastAccessed !== false) {
                server.DateLastAccessed = new Date().getTime();
            }
            server.Id = result.ServerId;

            if (saveCredentials) {
                server.UserId = result.User.Id;
                server.AccessToken = result.AccessToken;
            } else {
                server.UserId = null;
                server.AccessToken = null;
            }

            credentialProvider.addOrUpdateServer(credentials.Servers, server);
            credentialProvider.credentials(credentials);

            // Disable the legacy apiclient's bitrate detection as this feature is now upstreamed.
            apiClient.enableAutomaticBitrateDetection = false;

            apiClient.serverInfo(server);
            apiClient.setAuthenticationInfo(result.AccessToken, result.User.Id);
            afterConnected(apiClient, options);

            return onLocalUserSignIn(server, apiClient.serverAddress(), result.User);
        }

        function afterConnected(apiClient: ApiClient, options: { reportCapabilities?: boolean; [key: string]: unknown } = {}): void {
            if (options.reportCapabilities !== false) {
                apiClient.reportCapabilities(capabilities);
            }
            apiClient.enableAutomaticBitrateDetection = false;
        }

        function onLocalUserSignIn(server: ServerInfo, serverUrl: string | undefined, user: LocalUser): Promise<void> {
            // Ensure this is created so that listeners of the event can get the apiClient instance
            self._getOrAddApiClient(server, serverUrl);

            // This allows the app to have a single hook that fires before any other
            const promise = self.onLocalUserSignedIn ? self.onLocalUserSignedIn.call(self, user) : Promise.resolve();

            return promise.then(() => {
                events.trigger(self, 'localusersignedin', [user]);
            });
        }

        function validateAuthentication(server: ServerInfo, serverUrl: string): Promise<void> {
            return ajax({
                type: 'GET',
                url: `${serverUrl}/System/Info`,
                dataType: 'json',
                headers: {
                    [AUTHORIZATION_HEADER]: getAuthorizationHeader(
                        {
                            name: self.appName(),
                            version: self.appVersion()
                        },
                        {
                            id: self.deviceId(),
                            name: self.deviceName()
                        },
                        server.AccessToken ?? undefined
                    )
                }
            }).then(
                (systemInfo: unknown) => {
                    updateServerInfo(server, systemInfo as SystemInfo);
                    return Promise.resolve();
                },
                () => {
                    server.UserId = null;
                    server.AccessToken = null;
                    return Promise.resolve();
                }
            );
        }

        function getImageUrl(localUser: LocalUser | null): { url: string | null; supportsParams: boolean } {
            if (localUser && localUser.PrimaryImageTag) {
                const apiClient = self.getApiClient(localUser);

                const url = apiClient.getUserImageUrl(localUser.Id, {
                    tag: localUser.PrimaryImageTag,
                    type: 'Primary'
                });

                return {
                    url,
                    supportsParams: true
                };
            }

            return {
                url: null,
                supportsParams: false
            };
        }

        self.user = (apiClient: ApiClient) =>
            new Promise((resolve) => {
                let localUser: LocalUser | undefined;

                function onLocalUserDone(): void {
                    if (apiClient && apiClient.getCurrentUserId()) {
                        apiClient.getCurrentUser().then((u: LocalUser) => {
                            localUser = u;
                            const image = getImageUrl(localUser || null);

                            resolve({
                                localUser,
                                name: localUser ? localUser.Name || null : null,
                                imageUrl: image.url,
                                supportsImageParams: image.supportsParams
                            });
                        });
                    }
                }

                if (apiClient && apiClient.getCurrentUserId()) {
                    onLocalUserDone();
                }
            });

        self.logout = () => {
            const promises: Promise<void>[] = [];

            for (let i = 0, length = self._apiClients.length; i < length; i++) {
                const apiClient = self._apiClients[i];

                if (apiClient.accessToken()) {
                    promises.push(logoutOfServer(apiClient));
                }
            }

            return Promise.all(promises).then(() => {
                const credentials = credentialProvider.credentials();

                const servers = credentials.Servers.filter((u: ServerInfo) => u.UserLinkType !== 'Guest');

                for (let j = 0, numServers = servers.length; j < numServers; j++) {
                    const server = servers[j];

                    server.UserId = null;
                    server.AccessToken = null;
                    server.ExchangeToken = null;
                }
            });
        };

        function logoutOfServer(apiClient: ApiClient): Promise<void> {
            const serverInfo = apiClient.serverInfo() || {};

            const logoutInfo = {
                serverId: serverInfo.Id
            };

            return apiClient.logout().then(
                () => {
                    events.trigger(self, 'localusersignedout', [logoutInfo]);
                },
                () => {
                    events.trigger(self, 'localusersignedout', [logoutInfo]);
                }
            );
        }

        self.getSavedServers = () => {
            const credentials = credentialProvider.credentials();

            const servers = credentials.Servers.slice(0);

            servers.sort(sortByAccess);

            return servers;
        };

        self.getAvailableServers = () => {
            console.debug('[ConnectionManager] Begin getAvailableServers');

            // Clone the array
            const credentials = credentialProvider.credentials();

            return findServers().then((foundServers: ServerInfo[]) => {
                const servers = credentials.Servers.slice(0);
                foundServers.forEach((server: ServerInfo) => {
                    credentialProvider.addOrUpdateServer(servers, server);
                });

                servers.sort(sortByAccess);
                credentials.Servers = servers;
                credentialProvider.credentials(credentials);

                return servers;
            });
        };

        function findServers(): Promise<ServerInfo[]> {
            return new Promise((resolve) => {
                const onFinish = function (foundServers: Array<{ Id: string; Address: string; EndpointAddress?: string; Name: string; [key: string]: unknown }>): void {
                    const servers: ServerInfo[] = foundServers.map((foundServer) => {
                        const info: ServerInfo = {
                            Id: foundServer.Id,
                            LocalAddress: convertEndpointAddressToManualAddress(foundServer) || foundServer.Address,
                            Name: foundServer.Name
                        };
                        info.LastConnectionMode = info.ManualAddress ? ConnectionMode.Manual : ConnectionMode.Local;
                        return info;
                    });
                    resolve(servers);
                };

                if (window && (window as unknown as { NativeShell?: { findServers: (timeout: number) => Promise<Array<{ Id: string; Address: string; EndpointAddress?: string; Name: string; [key: string]: unknown }>> } }).NativeShell && typeof (window as unknown as { NativeShell: { findServers: (timeout: number) => Promise<Array<{ Id: string; Address: string; EndpointAddress?: string; Name: string; [key: string]: unknown }>> } }).NativeShell.findServers === 'function') {
                    (window as unknown as { NativeShell: { findServers: (timeout: number) => Promise<Array<{ Id: string; Address: string; EndpointAddress?: string; Name: string; [key: string]: unknown }>> } }).NativeShell.findServers(1e3).then(onFinish, function () {
                        onFinish([]);
                    });
                } else {
                    resolve([]);
                }
            });
        }

        function convertEndpointAddressToManualAddress(info: { Address?: string; EndpointAddress?: string; [key: string]: unknown }): string | null {
            if (info.Address && info.EndpointAddress) {
                let address = info.EndpointAddress.split(':')[0];

                // Determine the port, if any
                const parts = info.Address.split(':');
                if (parts.length > 1) {
                    const portString = parts[parts.length - 1];

                    if (!isNaN(parseInt(portString, 10))) {
                        address += `:${portString}`;
                    }
                }

                return normalizeAddress(address);
            }

            return null;
        }

        self.connectToServers = (servers: ServerInfo[], options?: ConnectOptions) => {
            console.debug(`Begin connectToServers, with ${servers.length} servers`);

            const firstServer = servers.length ? servers[0] : null;
            // See if we have any saved credentials and can auto sign in
            if (firstServer) {
                return self.connectToServer(firstServer, options).then((result: ConnectResult) => {
                    console.debug('resolving connectToServers with result.State: ' + result.State);
                    return result;
                });
            }

            return Promise.resolve({
                Servers: servers,
                State: ConnectionState.ServerSelection
            });
        };

        function getTryConnectPromise(url: string, connectionMode: number, state: { resolved?: boolean; rejects: number; numAddresses: number }, resolve: (value: { url: string; connectionMode: number; data: SystemInfo }) => void, reject: () => void): void {
            console.debug('getTryConnectPromise ' + url);

            ajax({
                url: `${url}/System/Info/Public`,
                timeout: DEFAULT_CONNECTION_TIMEOUT,
                type: 'GET',
                dataType: 'json'
            }).then(
                (result: unknown) => {
                    if (!state.resolved) {
                        state.resolved = true;

                        console.debug('Reconnect succeeded to ' + url);
                        resolve({
                            url: url,
                            connectionMode: connectionMode,
                            data: result as SystemInfo
                        });
                    }
                },
                () => {
                    console.debug('Reconnect failed to ' + url);

                    if (!state.resolved) {
                        state.rejects++;
                        if (state.rejects >= state.numAddresses) {
                            reject();
                        }
                    }
                }
            );
        }

        function tryReconnect(serverInfo: ServerInfo): Promise<{ url: string; connectionMode: number; data: SystemInfo }> {
            const addresses: Array<{ url: string; mode: number; timeout: number }> = [];
            const addressesStrings: string[] = [];

            // the timeouts are a small hack to try and ensure the remote address doesn't resolve first

            // manualAddressOnly is used for the local web app that always connects to a fixed address
            if (
                !serverInfo.manualAddressOnly
                && serverInfo.LocalAddress
                && addressesStrings.indexOf(serverInfo.LocalAddress) === -1
            ) {
                addresses.push({
                    url: serverInfo.LocalAddress,
                    mode: ConnectionMode.Local,
                    timeout: 0
                });
                addressesStrings.push(addresses[addresses.length - 1].url);
            }
            if (serverInfo.ManualAddress && addressesStrings.indexOf(serverInfo.ManualAddress) === -1) {
                addresses.push({
                    url: serverInfo.ManualAddress,
                    mode: ConnectionMode.Manual,
                    timeout: 100
                });
                addressesStrings.push(addresses[addresses.length - 1].url);
            }
            if (
                !serverInfo.manualAddressOnly
                && serverInfo.RemoteAddress
                && addressesStrings.indexOf(serverInfo.RemoteAddress) === -1
            ) {
                addresses.push({
                    url: serverInfo.RemoteAddress,
                    mode: ConnectionMode.Remote,
                    timeout: 200
                });
                addressesStrings.push(addresses[addresses.length - 1].url);
            }

            console.info('[ConnectionManager] tryReconnect addresses', addressesStrings);

            return new Promise((resolve, reject) => {
                const state: { resolved?: boolean; rejects: number; numAddresses: number } = { rejects: 0, numAddresses: addresses.length };
                state.numAddresses = addresses.length;
                state.rejects = 0;

                addresses.forEach((url) => {
                    setTimeout(() => {
                        if (!state.resolved) {
                            getTryConnectPromise(url.url, url.mode, state, resolve, reject);
                        }
                    }, url.timeout);
                });
            });
        }

        self.connectToServer = (server: ServerInfo, options?: ConnectOptions) => {
            console.debug('[ConnectionManager] begin connectToServer');

            return new Promise((resolve) => {
                options = options || {};

                tryReconnect(server).then(
                    (result: { url: string; connectionMode: number; data: SystemInfo }) => {
                        const serverUrl = result.url;
                        const connectionMode = result.connectionMode;
                        const data = result.data;

                        if (compareVersions(self.minServerVersion(), data.Version || '') === 1) {
                            console.warn('[ConnectionManager] minServerVersion requirement not met. Server version:', data.Version);
                            resolve({
                                State: ConnectionState.ServerUpdateNeeded,
                                Servers: [server]
                            });
                        } else if (server.Id && data.Id !== server.Id) {
                            console.warn(
                                '[ConnectionManager] http request succeeded, but found a different server Id than what was expected'
                            );
                            resolve({
                                State: ConnectionState.ServerMismatch
                            });
                        } else {
                            onSuccessfulConnection(server, data, connectionMode, serverUrl, true, resolve, options);
                        }
                    },
                    () => {
                        resolve({
                            State: ConnectionState.Unavailable
                        });
                    }
                );
            });
        };

        function onSuccessfulConnection(server: ServerInfo, systemInfo: SystemInfo, connectionMode: number, serverUrl: string, verifyLocalAuthentication: boolean, resolve: (value: ConnectResult) => void, options: ConnectOptions = {} as ConnectOptions): void {
            const credentials = credentialProvider.credentials();

            if (options.enableAutoLogin === false) {
                server.UserId = null;
                server.AccessToken = null;
            } else if (server.AccessToken && verifyLocalAuthentication) {
                void validateAuthentication(server, serverUrl).then(function () {
                    onSuccessfulConnection(server, systemInfo, connectionMode, serverUrl, false, resolve, options);
                });
                return;
            }

            updateServerInfo(server, systemInfo);

            server.LastConnectionMode = connectionMode;

            if (options.updateDateLastAccessed !== false) {
                server.DateLastAccessed = new Date().getTime();
            }
            credentialProvider.addOrUpdateServer(credentials.Servers, server);
            credentialProvider.credentials(credentials);

            const result: ConnectResult = {
                Servers: []
            };

            result.ApiClient = self._getOrAddApiClient(server, serverUrl);

            result.ApiClient.setSystemInfo(systemInfo);
            result.SystemInfo = systemInfo;

            result.State = server.AccessToken && options.enableAutoLogin !== false ? ConnectionState.SignedIn : ConnectionState.ServerSignIn;

            result.Servers!.push(server);

            // Disable the legacy apiclient's bitrate detection as this feature is now upstreamed.
            result.ApiClient.enableAutomaticBitrateDetection = false;

            result.ApiClient.updateServerInfo(server, serverUrl);
            result.ApiClient.setAuthenticationInfo(server.AccessToken ?? null, server.UserId ?? null);

            const resolveActions = function (): void {
                resolve(result);

                events.trigger(self, 'connected', [result]);
            };

            if (result.State === ConnectionState.SignedIn) {
                afterConnected(result.ApiClient, options);

                result.ApiClient.getCurrentUser().then((user: LocalUser) => {
                    onLocalUserSignIn(server, serverUrl, user).then(resolveActions, resolveActions);
                }, resolveActions);
            } else {
                resolveActions();
            }
        }

        self.updateSavedServerId = async (server: ServerInfo) => {
            const { data: serverResponse } = await tryReconnect(server);
            // Update the server ID to match the new value
            server.Id = (serverResponse as unknown as { Id?: string }).Id;
            // Force the user to login again
            server.AccessToken = null;
            server.UserId = null;

            // Save the updated server in the credential provider
            const credentials = credentialProvider.credentials();
            credentialProvider.addOrUpdateServer(credentials.Servers, server);
            credentialProvider.credentials(credentials);
        };

        function tryConnectToAddress(address: string, options?: ConnectOptions): Promise<ConnectResult> {
            const server: ServerInfo = {
                ManualAddress: address,
                LastConnectionMode: ConnectionMode.Manual
            };

            return self.connectToServer(server, options).then((result: ConnectResult) => {
                // connectToServer never rejects, but resolves with State=ConnectionState.Unavailable
                if (result.State === ConnectionState.Unavailable) {
                    return Promise.reject();
                }
                return result;
            });
        }

        self.connectToAddress = function (address: string, options?: ConnectOptions): Promise<ConnectResult> {
            if (!address) {
                return Promise.reject();
            }

            address = normalizeAddress(address);

            const urls: string[] = [];

            if (/^[^:]+:\/\//.test(address)) {
                // Protocol specified - connect as is
                urls.push(address);
            } else {
                urls.push(`https://${address}`);
                urls.push(`http://${address}`);
            }

            let i = 0;

            function onFail(): Promise<ConnectResult> {
                console.debug(`connectToAddress ${urls[i]} failed`);

                if (++i < urls.length) {
                    return tryConnectToAddress(urls[i], options).catch(onFail);
                }

                return Promise.resolve({
                    State: ConnectionState.Unavailable
                });
            }

            return tryConnectToAddress(urls[i], options).catch(onFail);
        };

        self.deleteServer = (serverId: string) => {
            if (!serverId) {
                throw new Error('null serverId');
            }

            let server: ServerInfo | null = credentialProvider.credentials().Servers.filter((s: ServerInfo) => s.Id === serverId)[0];
            server = server || null;

            return new Promise<void>((resolve) => {
                function onDone(): void {
                    const credentials = credentialProvider.credentials();

                    credentials.Servers = credentials.Servers.filter((s: ServerInfo) => s.Id !== serverId);

                    credentialProvider.credentials(credentials);
                    resolve();
                }

                if (!server?.ConnectServerId) {
                    onDone();
                }
            });
        };
    }

    connect(options?: ConnectOptions): Promise<ConnectResult> {
        console.debug('Begin connect');

        return this.getAvailableServers().then((servers: ServerInfo[]) => {
            return this.connectToServers(servers, options);
        });
    }

    handleMessageReceived(msg: { ServerId?: string; Data?: string | object; [key: string]: unknown }): void {
        const serverId = msg.ServerId;
        if (serverId) {
            const apiClient = this.getApiClient(serverId);
            if (apiClient) {
                if (typeof msg.Data === 'string') {
                    try {
                        msg.Data = JSON.parse(msg.Data);
                    } catch (err) {
                        console.warn('unable to parse json content: ' + err);
                    }
                }

                apiClient.handleMessageReceived(msg);
            }
        }
    }

    getApiClients(): ApiClient[] {
        const servers = this.getSavedServers();

        for (let i = 0, length = servers.length; i < length; i++) {
            const server = servers[i];
            if (server.Id) {
                this._getOrAddApiClient(server, getServerAddress(server, server.LastConnectionMode || 0));
            }
        }

        return this._apiClients;
    }

    /**
     * Gets the ApiClient for a given BaseItem or ServerId.
     * @param item - BaseItemDto or string (ServerId)
     * @returns ApiClient
     */
    getApiClient(item: { ServerId?: string; Id?: string } | string): ApiClient {
        if (!item) {
            throw new Error('item or serverId cannot be null');
        }

        // Accept string + object
        if (typeof item !== 'string' && item.ServerId) {
            item = item.ServerId;
        }

        return this._apiClients.filter((a: ApiClient) => {
            const serverInfo = a.serverInfo();

            // We have to keep this hack in here because of the addApiClient method
            return !serverInfo || serverInfo.Id === item;
        })[0];
    }

    minServerVersion(val?: string): string {
        if (val) {
            this._minServerVersion = val;
        }

        return this._minServerVersion;
    }
}

export interface ConnectOptions {
    enableAutoLogin?: boolean;
    updateDateLastAccessed?: boolean;
    reportCapabilities?: boolean;
    [key: string]: unknown;
}
