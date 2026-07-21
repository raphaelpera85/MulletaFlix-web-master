import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';

import { setBackdropTransparency, type TransparencyLevel } from '../backdrop/backdrop';
import globalize from '../../lib/globalize';
import itemHelper from '../itemHelper';
import loading from '../loading/loading';
import alert from '../alert';

import layoutManager from 'components/layoutManager';
import { LayoutMode } from 'constants/layoutMode';
import { getItemQuery } from 'hooks/useItem';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { queryClient } from 'utils/query/queryClient';
import { history } from 'RootAppRouter';

/** Pages of "no return" (when "Go back" should behave differently, probably quitting the application). */
const START_PAGE_PATHS = ['/home', '/login', '/selectserver'];

/** Pages that do not require a user to be logged in to view. */
export const PUBLIC_PATHS: string[] = [
    '/addserver',
    '/selectserver',
    '/login',
    '/forgotpassword',
    '/forgotpasswordpin',
    '/wizardremoteaccess',
    '/wizardfinish',
    '/wizardlibrary',
    '/wizardsettings',
    '/wizardstart',
    '/wizarduser'
];

type RouteTarget = string | RouteItem;

interface RouteOptions {
    context?: CollectionType | string | null;
    itemType?: string | null;
    itemTypes?: string;
    serverId?: string | null;
    section?: string | null;
    parentId?: string | null;
    tag?: string;
    isFavorite?: boolean;
    isAiring?: boolean;
    isMovie?: boolean;
    isSeries?: boolean;
    isSports?: boolean;
    isKids?: boolean;
    isNews?: boolean;
}

interface RouteItem {
    url?: string | null;
    Id?: string | null;
    ItemId?: string | null;
    Type?: string | null;
    Name?: string | null;
    ServerId?: string | null;
    CollectionType?: string | null;
    IsFolder?: boolean | null;
}

interface ApiClientWithUserId {
    getCurrentUserId(): string | null | undefined;
}

interface ApiClientWithServerId {
    serverId(): string;
}

class AppRouter {
    forcedLogoutMsg: string | null = null;
    msgTimeout: ReturnType<typeof setTimeout> | null = null;
    promiseShow: Promise<void> | null = null;
    resolveOnNextShow: (() => void) | null = null;
    lastPath: string;
    baseRoute: string;

    constructor() {
        document.addEventListener('viewshow', () => this.onViewShow());

        this.lastPath = history.location.pathname + history.location.search;
        this.listen();

        // TODO: Can this baseRoute logic be simplified?
        this.baseRoute = window.location.href.split('?')[0].replace(this.#getRequestFile(), '');
        // support hashbang
        this.baseRoute = this.baseRoute.split('#')[0];
        if (this.baseRoute.endsWith('/') && !this.baseRoute.endsWith('://')) {
            this.baseRoute = this.baseRoute.substring(0, this.baseRoute.length - 1);
        }
    }

    ready(): Promise<void> {
        return this.promiseShow || Promise.resolve();
    }

    async back(): Promise<void> {
        if (this.promiseShow) await this.promiseShow;

        this.promiseShow = new Promise<void>((resolve) => {
            const unlisten = history.listen(() => {
                unlisten();
                this.promiseShow = null;
                resolve();
            });
            history.back();
        });

        return this.promiseShow;
    }

    async show(path: string, options?: RouteOptions): Promise<void> {
        if (this.promiseShow) await this.promiseShow;

        // ensure the path does not start with '#' since the router adds this
        if (path.startsWith('#')) {
            path = path.substring(1);
        }
        // Support legacy '#!' routes since people may have old bookmarks, etc.
        if (path.startsWith('!')) {
            path = path.substring(1);
        }

        if (path.indexOf('/') !== 0 && path.indexOf('://') === -1) {
            path = '/' + path;
        }

        path = path.replace(this.baseUrl(), '');

        // can't use this with home right now due to the back menu
        if (history.location.pathname === path && path !== '/home') {
            loading.hide();
            return Promise.resolve();
        }

        this.promiseShow = new Promise<void>((resolve) => {
            this.resolveOnNextShow = resolve;
            setTimeout(() => history.push(path, options), 0);
        });

        return this.promiseShow;
    }

    listen(): void {
        history.listen(({ location }) => {
            const normalizedPath = location.pathname.replace(/^!/, '');
            const fullPath = normalizedPath + location.search;

            if (fullPath === this.lastPath) {
                console.debug('[appRouter] path did not change, resolving promise');
                this.onViewShow();
            }

            this.lastPath = fullPath;
        });
    }

    baseUrl(): string {
        return this.baseRoute;
    }

    canGoBack(path: string = history.location.pathname): boolean {
        if (
            !document.querySelector('.dialogContainer')
            && START_PAGE_PATHS.includes(path)
        ) {
            return false;
        }

        return window.history.length > 1;
    }

    showItem(item: string | null | undefined, serverId?: string | null, options?: RouteOptions): void;
    showItem(item: RouteItem | null | undefined, serverId?: string | RouteOptions | null, options?: RouteOptions): void;
    showItem(item: RouteTarget | null | undefined, serverId?: string | RouteOptions | null, options?: RouteOptions): void {
        // TODO: Refactor this so it only gets items, not strings.
        if (typeof item === 'string') {
            const apiClient = (typeof serverId === 'string'
                ? ServerConnections.getApiClient(serverId)
                : ServerConnections.currentApiClient()) as ApiClientWithUserId | undefined;
            if (!apiClient) {
                throw new Error('No api client available');
            }
            const api = toApi(apiClient as any);
            const userId = apiClient.getCurrentUserId() ?? undefined;

            queryClient
                .fetchQuery(getItemQuery(api, item, userId))
                .then(itemObject => {
                    this.showItem(itemObject as RouteItem, options);
                })
                .catch(err => {
                    console.error('[AppRouter] Failed to fetch item', err);
                });
            return;
        }

        const routeOptions = (typeof serverId === 'object' ? serverId : options) ?? undefined;
        const url = this.getRouteUrl(item, routeOptions);
        void this.show(url);
    }

    /**
     * Sets the backdrop, background, and document transparency
     * @deprecated use Dashboard.setBackdropTransparency
     */
    setTransparency(level: TransparencyLevel | number): void {
        // TODO: Remove this after JMP is updated to not use this function
        console.warn('Deprecated! Use Dashboard.setBackdropTransparency');
        setBackdropTransparency(level);
    }

    onViewShow(): void {
        const resolve = this.resolveOnNextShow;
        if (resolve) {
            this.promiseShow = null;
            this.resolveOnNextShow = null;
            resolve();
        }
    }

    onForcedLogoutMessageTimeout(): void {
        const msg = this.forcedLogoutMsg;
        this.forcedLogoutMsg = null;

        if (msg) {
            alert(msg);
        }
    }

    showForcedLogoutMessage(msg: string): void {
        this.forcedLogoutMsg = msg;
        if (this.msgTimeout) {
            clearTimeout(this.msgTimeout);
        }

        this.msgTimeout = setTimeout(() => this.onForcedLogoutMessageTimeout(), 100);
    }

    onRequestFail(this: ApiClientWithServerId, _e: Event, data: { status: number; errorCode?: string }): void {
        const apiClient = this;

        if (data.status === 403 && data.errorCode === 'ParentalControl') {
            const isPublicPage = PUBLIC_PATHS.includes(history.location.pathname as (typeof PUBLIC_PATHS)[number]);

            // Bounce to the login screen, but not if a password entry fails, obviously
            if (!isPublicPage) {
                appRouter.showForcedLogoutMessage(globalize.translate('AccessRestrictedTryAgainLater'));
                appRouter.showLocalLogin(apiClient.serverId());
            }
        }
    }

    #getRequestFile(): string {
        let path = window.location.pathname || '';

        const index = path.lastIndexOf('/');
        if (index !== -1) {
            path = path.substring(index);
        } else {
            path = '/' + path;
        }

        if (!path || path === '/') {
            path = '/index.html';
        }

        return path;
    }

    getRouteUrl(item: RouteTarget | null | undefined, options?: RouteOptions): string {
        if (!item) {
            throw new Error('item cannot be null');
        }

        if (typeof item !== 'string' && item.url) {
            return item.url;
        }

        const context = options ? options.context : null;
        const id = typeof item === 'string' ? undefined : (item.Id || item.ItemId);

        if (!options) {
            options = {};
        }

        let url;
        const itemType = typeof item === 'string' ? (options.itemType ?? null) : (item.Type || options.itemType || null);
        const serverId = typeof item === 'string' ? options.serverId : (item.ServerId || options.serverId);

        if (item === 'settings') {
            return '#/mypreferencesmenu';
        }

        if (item === 'wizard') {
            return '#/wizardstart';
        }

        if (item === 'manageserver') {
            return '#/dashboard';
        }

        if (item === 'recordedtv') {
            return '#/livetv?tab=3&serverId=' + serverId;
        }

        if (item === 'nextup') {
            return '#/list?type=nextup&serverId=' + serverId;
        }

        if (item === 'list') {
            let urlForList = '#/list?serverId=' + serverId + '&type=' + options.itemTypes;

            if (options.isFavorite) {
                urlForList += '&IsFavorite=true';
            }

            if (options.isAiring) {
                urlForList += '&IsAiring=true';
            }

            if (options.isMovie) {
                urlForList += '&IsMovie=true';
            }

            if (options.isSeries) {
                urlForList += '&IsSeries=true&IsMovie=false&IsNews=false';
            }

            if (options.isSports) {
                urlForList += '&IsSports=true';
            }

            if (options.isKids) {
                urlForList += '&IsKids=true';
            }

            if (options.isNews) {
                urlForList += '&IsNews=true';
            }

            if (options.parentId) {
                urlForList += '&parentId=' + options.parentId;
            }

            return urlForList;
        }

        if (item === 'livetv') {
            if (options.section === 'programs') {
                return '#/livetv?tab=0&serverId=' + serverId;
            }
            if (options.section === 'guide') {
                return '#/livetv?tab=1&serverId=' + serverId;
            }

            if (options.section === 'movies') {
                return '#/list?type=Programs&IsMovie=true&serverId=' + serverId;
            }

            if (options.section === 'shows') {
                return '#/list?type=Programs&IsSeries=true&IsMovie=false&IsNews=false&serverId=' + serverId;
            }

            if (options.section === 'sports') {
                return '#/list?type=Programs&IsSports=true&serverId=' + serverId;
            }

            if (options.section === 'kids') {
                return '#/list?type=Programs&IsKids=true&serverId=' + serverId;
            }

            if (options.section === 'news') {
                return '#/list?type=Programs&IsNews=true&serverId=' + serverId;
            }

            if (options.section === 'onnow') {
                return '#/list?type=Programs&IsAiring=true&serverId=' + serverId;
            }

            if (options.section === 'channels') {
                return '#/livetv?tab=2&serverId=' + serverId;
            }

            if (options.section === 'dvrschedule') {
                return '#/livetv?tab=4&serverId=' + serverId;
            }

            if (options.section === 'seriesrecording') {
                return '#/livetv?tab=5&serverId=' + serverId;
            }

            return '#/livetv?serverId=' + serverId;
        }

        if (itemType === 'SeriesTimer') {
            return '#/details?seriesTimerId=' + id + '&serverId=' + serverId;
        }

        if (typeof item !== 'string' && item.CollectionType == CollectionType.Livetv) {
            return `#/livetv?collectionType=${item.CollectionType}`;
        }

        if (typeof item !== 'string' && item.Type === 'Genre') {
            url = '#/list?genreId=' + item.Id + '&serverId=' + serverId;

            if (context === 'livetv') {
                url += '&type=Programs';
            }

            if (options.parentId) {
                url += '&parentId=' + options.parentId;
            }

            return url;
        }

        if (typeof item !== 'string' && item.Type === 'MusicGenre') {
            url = '#/list?musicGenreId=' + item.Id + '&serverId=' + serverId;

            if (options.parentId) {
                url += '&parentId=' + options.parentId;
            }

            return url;
        }

        if (typeof item !== 'string' && item.Type === 'Studio') {
            url = '#/list?studioId=' + item.Id + '&serverId=' + serverId;

            if (options.parentId) {
                url += '&parentId=' + options.parentId;
            }

            return url;
        }

        if (item === 'tag') {
            url = `#/list?type=tag&tag=${encodeURIComponent(options.tag ?? '')}&serverId=${serverId}`;

            if (options.parentId) {
                url += '&parentId=' + options.parentId;
            }

            return url;
        }

        if (context !== 'folders' && typeof item !== 'string' && !itemHelper.isLocalItem(item)) {
            const isExperimentalLayout = layoutManager.layout === LayoutMode.Experimental;

            if (isExperimentalLayout && item.CollectionType == CollectionType.Books) {
                url = `#/books?topParentId=${item.Id}&collectionType=${item.CollectionType}`;

                if (options?.section === 'latest') {
                    url += '&tab=3';
                }
                return url;
            }

            if (item.CollectionType == CollectionType.Movies) {
                url = `#/movies?topParentId=${item.Id}&collectionType=${item.CollectionType}`;

                if (options && options.section === 'latest') {
                    url += '&tab=1';
                }

                return url;
            }

            if (item.CollectionType == CollectionType.Tvshows) {
                url = `#/tv?topParentId=${item.Id}&collectionType=${item.CollectionType}`;

                if (options && options.section === 'latest') {
                    url += '&tab=1';
                }

                return url;
            }

            if (item.CollectionType == CollectionType.Music) {
                url = `#/music?topParentId=${item.Id}&collectionType=${item.CollectionType}`;

                if (options?.section === 'latest') {
                    url += '&tab=1';
                }

                return url;
            }

            if (isExperimentalLayout && item.CollectionType == CollectionType.Homevideos) {
                return '#/homevideos?topParentId=' + item.Id;
            }

            if (isExperimentalLayout && item.CollectionType == CollectionType.Musicvideos) {
                url = `#/musicvideos?topParentId=${item.Id}&collectionType=${item.CollectionType}`;

                if (options?.section === 'latest') {
                    url += '&tab=1';
                }
                return url;
            }

            if (isExperimentalLayout && item.CollectionType == CollectionType.Boxsets) {
                return `#/boxsets?topParentId=${item.Id}&collectionType=${item.CollectionType}`;
            }

            if (isExperimentalLayout && item.CollectionType == CollectionType.Playlists) {
                return `#/playlists?topParentId=${item.Id}&collectionType=${item.CollectionType}`;
            }

            if (isExperimentalLayout && item.CollectionType == null && item.Type === 'CollectionFolder') {
                url = `#/mixed?topParentId=${item.Id}&collectionType=mixed`;

                if (options?.section === 'latest') {
                    url += '&tab=1';
                }

                return url;
            }
        }

        const itemTypes = ['Playlist', 'TvChannel', 'Program', 'BoxSet', 'MusicAlbum', 'MusicGenre', 'Person', 'Recording', 'MusicArtist'];

        if (itemTypes.indexOf(itemType ?? '') >= 0) {
            return '#/details?id=' + id + '&serverId=' + serverId;
        }

        const contextSuffix = context ? '&context=' + context : '';

        if (itemType === 'Series' || itemType === 'Season' || itemType === 'Episode') {
            return '#/details?id=' + id + contextSuffix + '&serverId=' + serverId;
        }

        if (typeof item !== 'string' && item.IsFolder) {
            if (id) {
                return '#/list?parentId=' + id + '&serverId=' + serverId;
            }

            return '#';
        }

        return '#/details?id=' + id + '&serverId=' + serverId;
    }

    showLocalLogin(serverId: string): Promise<void> {
        return this.show('login?serverid=' + serverId);
    }

    showVideoOsd(): Promise<void> {
        return this.show('video');
    }

    showSelectServer(): Promise<void> {
        return this.show('selectserver');
    }

    showSettings(): Promise<void> {
        return this.show('mypreferencesmenu');
    }

    showNowPlaying(): Promise<void> {
        return this.show('queue');
    }

    showGuide(): Promise<void> {
        return this.show('livetv?tab=1');
    }

    goHome(): Promise<void> {
        return this.show('home');
    }

    showSearch(): Promise<void> {
        return this.show('search');
    }

    showLiveTV(): Promise<void> {
        return this.show('livetv');
    }

    showRecordedTV(): Promise<void> {
        return this.show('livetv?tab=3');
    }

    showFavorites(): Promise<void> {
        return this.show('home?tab=1');
    }
}

export const appRouter = new AppRouter();

export const isLyricsPage = (): boolean => history.location.pathname.toLowerCase() === '/lyrics';

const embyWindow = window as Window & { Emby?: { Page?: AppRouter } };
embyWindow.Emby = embyWindow.Emby || {};
embyWindow.Emby.Page = appRouter;
