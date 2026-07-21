import Events from '../../../utils/events.ts';
import { getItems } from '../../../utils/jellyfin-apiclient/getItems.ts';

export const WaitForEventDefaultTimeout = 30000;
export const WaitForPlayerEventTimeout = 500;
export const TicksPerMillisecond = 10000.0;

interface PlaybackQuery {
    Ids?: string;
    Limit?: number;
    Fields?: string[];
    ExcludeLocationTypes?: string;
    EnableTotalRecordCount?: boolean;
    CollapseBoxSetItems?: boolean;
    ParentId?: string;
    SortBy?: string | null;
    ArtistIds?: string;
    Filters?: string;
    Recursive?: boolean;
    MediaTypes?: string;
    GenreIds?: string;
}

interface PlaybackItem {
    Id: any;
    Type?: string;
    MediaType?: string;
    IsFolder?: boolean;
    ParentId?: string;
    ChannelId?: string;
    SeriesId?: string;
}

export function waitForEventOnce(emitter: any, eventType: string, timeout?: number, rejectEventTypes?: string[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
        let rejectTimeout: ReturnType<typeof setTimeout> | undefined;
        if (timeout) {
            rejectTimeout = setTimeout(() => {
                reject(new Error('Timed out.'));
            }, timeout);
        }

        const clearAll = (): void => {
            Events.off(emitter, eventType, callback);

            if (rejectTimeout) {
                clearTimeout(rejectTimeout);
            }

            if (Array.isArray(rejectEventTypes)) {
                rejectEventTypes.forEach((eventName) => {
                    Events.off(emitter, eventName, rejectCallback);
                });
            }
        };

        const callback = (...args: any[]): void => {
            clearAll();
            resolve(args);
        };

        const rejectCallback = (event: { type: string }): void => {
            clearAll();
            reject(event.type);
        };

        Events.on(emitter, eventType, callback);

        if (Array.isArray(rejectEventTypes)) {
            rejectEventTypes.forEach((eventName) => {
                Events.on(emitter, eventName, rejectCallback);
            });
        }
    });
}

export function stringToGuid(input: string): string {
    return input.replace(/([0-z]{8})([0-z]{4})([0-z]{4})([0-z]{4})([0-z]{12})/, '$1-$2-$3-$4-$5');
}

export function getItemsForPlayback(apiClient: any, query: PlaybackQuery): Promise<any> {
    if (query.Ids && query.Ids.split(',').length === 1) {
        const itemId = query.Ids.split(',');

        return apiClient.getItem(apiClient.getCurrentUserId(), itemId).then((item: PlaybackItem) => {
            return {
                Items: [item]
            };
        });
    }

    query.Limit = query.Limit || 300;
    query.Fields = ['Chapters', 'Trickplay'];
    query.ExcludeLocationTypes = 'Virtual';
    query.EnableTotalRecordCount = false;
    query.CollapseBoxSetItems = false;

    return getItems(apiClient, apiClient.getCurrentUserId(), query);
}

function mergePlaybackQueries(obj1: PlaybackQuery, obj2: PlaybackQuery): PlaybackQuery {
    const query = Object.assign(obj1, obj2);

    const filters = query.Filters ? query.Filters.split(',') : [];
    if (filters.indexOf('IsNotFolder') === -1) {
        filters.push('IsNotFolder');
    }
    query.Filters = filters.join(',');
    return query;
}

export function translateItemsForPlayback(apiClient: any, items: PlaybackItem[], options: { ids?: string[]; queryOptions?: PlaybackQuery; shuffle?: boolean; startIndex?: number; serverId?: string }): Promise<any[]> {
    if (items.length > 1 && options?.ids) {
        items.sort((a, b) => {
            return options.ids!.indexOf(a.Id) - options.ids!.indexOf(b.Id);
        });
    }

    const firstItem = items[0];
    let promise: Promise<any> | undefined;

    const queryOptions = options.queryOptions || {};

    if (firstItem.Type === 'Program') {
        promise = getItemsForPlayback(apiClient, {
            Ids: firstItem.ChannelId
        });
    } else if (firstItem.Type === 'Playlist') {
        promise = getItemsForPlayback(apiClient, {
            ParentId: firstItem.Id,
            SortBy: options.shuffle ? 'Random' : null
        });
    } else if (firstItem.Type === 'MusicArtist') {
        promise = getItemsForPlayback(apiClient, {
            ArtistIds: firstItem.Id,
            Filters: 'IsNotFolder',
            Recursive: true,
            SortBy: options.shuffle ? 'Random' : 'SortName',
            MediaTypes: 'Audio'
        });
    } else if (firstItem.MediaType === 'Photo') {
        promise = getItemsForPlayback(apiClient, {
            ParentId: firstItem.ParentId,
            Filters: 'IsNotFolder',
            Recursive: false,
            SortBy: options.shuffle ? 'Random' : 'SortName',
            MediaTypes: 'Photo,Video'
        }).then((result) => {
            const resultItems = result.Items || [];
            let index = resultItems.map((i: any) => {
                return i.Id;
            }).indexOf(firstItem.Id);

            if (index === -1) {
                index = 0;
            }

            options.startIndex = index;

            return Promise.resolve(result);
        });
    } else if (firstItem.Type === 'PhotoAlbum') {
        promise = getItemsForPlayback(apiClient, {
            ParentId: firstItem.Id,
            Filters: 'IsNotFolder',
            Recursive: false,
            SortBy: options.shuffle ? 'Random' : 'SortName',
            MediaTypes: 'Photo,Video',
            Limit: 1000
        });
    } else if (firstItem.Type === 'MusicGenre') {
        promise = getItemsForPlayback(apiClient, {
            GenreIds: firstItem.Id,
            Filters: 'IsNotFolder',
            Recursive: true,
            SortBy: options.shuffle ? 'Random' : 'SortName',
            MediaTypes: 'Audio'
        });
    } else if (firstItem.IsFolder) {
        let sortBy: string | null = null;
        if (options.shuffle) {
            sortBy = 'Random';
        } else if (firstItem.Type === 'BoxSet') {
            sortBy = 'SortName';
        }
        promise = getItemsForPlayback(apiClient, mergePlaybackQueries({
            ParentId: firstItem.Id,
            Filters: 'IsNotFolder',
            Recursive: true,
            SortBy: sortBy,
            MediaTypes: 'Audio,Video'
        }, queryOptions));
    } else if (firstItem.Type === 'Episode' && items.length === 1) {
        promise = new Promise((resolve, reject) => {
            apiClient.getCurrentUser().then((user: { Configuration: { EnableNextEpisodeAutoPlay: boolean } }) => {
                if (!user.Configuration.EnableNextEpisodeAutoPlay || !firstItem.SeriesId) {
                    resolve(null);
                    return;
                }

                apiClient.getEpisodes(firstItem.SeriesId, {
                    IsVirtualUnaired: false,
                    IsMissing: false,
                    UserId: apiClient.getCurrentUserId(),
                    Fields: ['Chapters', 'Trickplay']
                }).then((episodesResult: any) => {
                    let foundItem = false;
                    episodesResult.Items = (episodesResult.Items || []).filter((e: any) => {
                        if (foundItem) {
                            return true;
                        }
                        if (e.Id === firstItem.Id) {
                            foundItem = true;
                            return true;
                        }

                        return false;
                    });
                    episodesResult.TotalRecordCount = episodesResult.Items.length;
                    resolve(episodesResult);
                }, reject);
            });
        });
    }

    if (promise) {
        return promise.then((result) => {
            return result ? (result.Items || items) : items;
        });
    }

    return Promise.resolve(items);
}
