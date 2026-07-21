import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { LocationType } from '@jellyfin/sdk/lib/generated-client/models/location-type';
import { RecordingStatus } from '@jellyfin/sdk/lib/generated-client/models/recording-status';
import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';
import { getPlaylistsApi } from '@jellyfin/sdk/lib/utils/api/playlists-api';

import { appHost } from './apphost';
import { AppFeature } from 'constants/appFeature';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';

export function getDisplayName(item: any, options: any = {}): string {
    if (!item) {
        throw new Error('null item passed into getDisplayName');
    }

    if (item.Type === 'Timer') {
        item = item.ProgramInfo || item;
    }

    let name = ((item.Type === 'Program' || item.Type === 'Recording') && (item.IsSeries || item.EpisodeTitle) ? item.EpisodeTitle : item.Name) || '';

    if (item.Type === 'TvChannel') {
        const channelName = item.Name || item.ChannelName || '';
        return channelName.replace(/^\s*\d+\s+/, '').trim() || item.ChannelName || item.ChannelNumber || '';
    }
    if (item.Type === 'Episode' && item.ParentIndexNumber === 0) {
        name = globalize.translate('ValueSpecialEpisodeName', name);
    } else if ((item.Type === 'Episode' || item.Type === 'Program' || item.Type === 'Recording') && item.IndexNumber != null && item.ParentIndexNumber != null && options.includeIndexNumber !== false) {
        let displayIndexNumber = item.IndexNumber;
        let number: any = displayIndexNumber;
        let nameSeparator = ' - ';

        if (options.includeParentInfo !== false) {
            number = 'S' + item.ParentIndexNumber + ':E' + number;
        } else {
            nameSeparator = '. ';
        }

        if (item.IndexNumberEnd) {
            displayIndexNumber = item.IndexNumberEnd;
            number += '-' + displayIndexNumber;
        }

        if (number) {
            name = name ? (number + nameSeparator + name) : number;
        }
    }

    return name;
}

export function supportsAddingToCollection(item: any): boolean {
    const invalidTypes = ['Genre', 'MusicGenre', 'Studio', 'UserView', 'CollectionFolder', 'Audio', 'Program', 'Timer', 'SeriesTimer'];

    if (item.Type === 'Recording' && item.Status !== 'Completed') {
        return false;
    }

    return !item.CollectionType && invalidTypes.indexOf(item.Type) === -1 && item.MediaType !== 'Photo' && !isLocalItem(item);
}

export function supportsAddingToPlaylist(item: any): boolean {
    if (item.Type === 'Program') return false;
    if (item.Type === 'TvChannel') return false;
    if (item.Type === 'Timer') return false;
    if (item.Type === 'SeriesTimer') return false;
    if (item.MediaType === 'Photo') return false;
    if (item.Type === 'Recording' && item.Status !== 'Completed') return false;
    if (isLocalItem(item)) return false;
    if (item.CollectionType === CollectionType.Livetv) return false;

    return !!(item.MediaType || item.IsFolder || item.Type === 'Genre' || item.Type === 'MusicGenre' || item.Type === 'MusicArtist');
}

export function canEdit(user: any, item: any): boolean {
    const itemType = item.Type;

    if (itemType === 'UserRootFolder' || itemType === 'UserView') return false;
    if (itemType === 'Program') return false;
    if (itemType === 'Timer') return false;
    if (itemType === 'SeriesTimer') return false;
    if (item.Type === 'Recording' && item.Status !== 'Completed') return false;
    if (isLocalItem(item)) return false;

    return user.Policy.IsAdministrator;
}

export function isLocalItem(item: any): boolean {
    return !!(item?.Id && typeof item.Id === 'string' && item.Id.indexOf('local') === 0);
}

export function canIdentify(user: any, item: any): boolean {
    const itemType = item.Type;

    return (itemType === 'Movie'
        || itemType === 'Trailer'
        || itemType === 'Series'
        || itemType === 'BoxSet'
        || itemType === 'Person'
        || itemType === 'Book'
        || itemType === 'MusicAlbum'
        || itemType === 'MusicArtist'
        || itemType === 'MusicVideo')
        && user.Policy.IsAdministrator
        && !isLocalItem(item);
}

export function canEditImages(user: any, item: any): boolean {
    const itemType = item.Type;

    if (item.MediaType === 'Photo') return false;
    if (itemType === 'UserView') return !!user.Policy.IsAdministrator;
    if (item.Type === 'Recording' && item.Status !== 'Completed') return false;

    return itemType !== 'Timer' && itemType !== 'SeriesTimer' && canEdit(user, item) && !isLocalItem(item);
}

export async function canEditPlaylist(user: any, item: any): Promise<boolean> {
    const apiClient: any = ServerConnections.getApiClient(item.ServerId);
    const api: any = toApi(apiClient);

    try {
        const { data: permissions } = await getPlaylistsApi(api)
            .getPlaylistUser({
                userId: user.Id,
                playlistId: item.Id
            });

        return !!permissions.CanEdit;
    } catch (err) {
        console.error('Failed to get playlist permissions', err);
    }

    return false;
}

export function canEditSubtitles(user: any, item: any): boolean {
    if (item.MediaType !== MediaType.Video) return false;
    const itemType = item.Type;
    if (itemType === BaseItemKind.Recording && item.Status !== RecordingStatus.Completed) return false;
    if (itemType === BaseItemKind.TvChannel
        || itemType === BaseItemKind.Program
        || itemType === 'Timer'
        || itemType === 'SeriesTimer'
        || itemType === BaseItemKind.UserRootFolder
        || itemType === BaseItemKind.UserView
    ) {
        return false;
    }
    if (isLocalItem(item)) return false;
    if (item.LocationType === LocationType.Virtual) return false;

    return user.Policy.EnableSubtitleManagement || user.Policy.IsAdministrator;
}

export function canEditLyrics(user: any, item: any): boolean {
    if (item.MediaType !== MediaType.Audio) return false;
    if (isLocalItem(item)) return false;
    return user.Policy.IsAdministrator;
}

export function canShare(item: any, user: any): boolean {
    if (item.Type === 'Program') return false;
    if (item.Type === 'TvChannel') return false;
    if (item.Type === 'Timer') return false;
    if (item.Type === 'SeriesTimer') return false;
    if (item.Type === 'Recording' && item.Status !== 'Completed') return false;
    if (isLocalItem(item)) return false;

    return user.Policy.EnablePublicSharing && appHost.supports(AppFeature.Sharing);
}

export function enableDateAddedDisplay(item: any): boolean {
    return !item.IsFolder && item.MediaType && item.Type !== 'Program' && item.Type !== 'TvChannel' && item.Type !== 'Trailer';
}

export function canMarkPlayed(item: any): boolean {
    if (item.Type === 'Program') return false;

    if (item.MediaType === 'Video') {
        if (item.Type !== 'TvChannel') {
            return true;
        }
    } else if (item.MediaType === 'Audio') {
        if (item.Type === 'AudioBook') {
            return true;
        }
    }

    return item.Type === 'Series'
        || item.Type === 'Season'
        || item.Type === 'BoxSet'
        || item.MediaType === 'Book';
}

export function canRate(item: any): boolean {
    return item.Type !== 'Program'
        && item.Type !== 'Timer'
        && item.Type !== 'SeriesTimer'
        && item.Type !== 'CollectionFolder'
        && item.Type !== 'UserView'
        && item.Type !== 'Channel'
        && item.UserData;
}

export function canConvert(item: any, user: any): boolean {
    if (!user.Policy.EnableMediaConversion) return false;
    if (isLocalItem(item)) return false;

    const mediaType = item.MediaType;
    if (mediaType === 'Book' || mediaType === 'Photo' || mediaType === 'Audio') return false;

    const collectionType = item.CollectionType;
    if (collectionType === CollectionType.Livetv) return false;

    const type = item.Type;
    if (type === 'Channel' || type === 'Person' || type === 'Year' || type === 'Program' || type === 'Timer' || type === 'SeriesTimer') return false;
    if (item.LocationType === 'Virtual' && !item.IsFolder) return false;

    return !item.IsPlaceHolder;
}

export function canRefreshMetadata(item: any, user: any): boolean {
    if (!user.Policy.IsAdministrator) {
        return false;
    }

    const collectionType = item.CollectionType;
    if (collectionType === CollectionType.Livetv) {
        return false;
    }

    return item.Type !== 'Timer'
        && item.Type !== 'SeriesTimer'
        && item.Type !== 'Program'
        && item.Type !== 'TvChannel'
        && !(item.Type === 'Recording' && item.Status !== 'Completed')
        && !isLocalItem(item);
}

export function supportsMediaSourceSelection(item: any): boolean {
    if (item.MediaType !== 'Video') return false;
    if (item.Type === 'TvChannel') return false;
    if (!item.MediaSources || (item.MediaSources.length === 1 && item.MediaSources[0].Type === 'Placeholder')) return false;
    if (item.EnableMediaSourceDisplay != null) return !!item.EnableMediaSourceDisplay;

    return !item.SourceType || item.SourceType === 'Library';
}

export function sortTracks(trackA: any, trackB: any): number {
    let cmp = trackA.IsExternal - trackB.IsExternal;
    if (cmp != 0) return cmp;
    cmp = trackB.IsForced - trackA.IsForced;
    if (cmp != 0) return cmp;
    cmp = trackB.IsDefault - trackA.IsDefault;
    if (cmp != 0) return cmp;

    return trackA.Index - trackB.Index;
}

export default {
    getDisplayName,
    supportsAddingToCollection,
    supportsAddingToPlaylist,
    isLocalItem,
    canIdentify,
    canEdit,
    canEditImages,
    canEditSubtitles,
    canEditLyrics,
    canShare,
    enableDateAddedDisplay,
    canMarkPlayed,
    canRate,
    canConvert,
    canRefreshMetadata,
    supportsMediaSourceSelection,
    sortTracks
};
