import { getPlaylistsApi } from '@jellyfin/sdk/lib/utils/api/playlists-api';

import listView from 'components/listview/listview';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';

interface PlaylistItem {
    Id: string;
    ServerId: string;
    [key: string]: any;
}

interface PlaylistData {
    CanEdit?: boolean;
    [key: string]: any;
}

function getFetchPlaylistItemsFn(apiClient: any, itemId: string): () => Promise<any> {
    return function () {
        const query = {
            Fields: 'PrimaryImageAspectRatio,MediaSourceCount,Chapters,Trickplay',
            EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
            UserId: apiClient.getCurrentUserId()
        };
        return apiClient.getJSON(apiClient.getUrl(`Playlists/${itemId}/Items`, query));
    };
}

function getItemsHtmlFn(playlistId: string, isEditable: boolean = false): (items: any[]) => string {
    return function (items: any[]) {
        return listView.getListViewHtml({
            items,
            showIndex: false,
            playFromHere: true,
            action: 'playallfromhere',
            smallIcon: true,
            dragHandle: isEditable,
            playlistId,
            showParentTitle: true
        });
    };
}

async function init(page: HTMLElement, item: PlaylistItem): Promise<void> {
    const apiClient = ServerConnections.getApiClient(item.ServerId) as any;
    const api = toApi(apiClient) as any;

    let isEditable = false;
    const { data } = await getPlaylistsApi(api)
        .getPlaylistUser({
            playlistId: item.Id,
            userId: apiClient.getCurrentUserId()
        })
        .catch((err: any) => {
            // If a user doesn't have access, then the request will 404 and throw
            console.info('[PlaylistViewer] Failed to fetch playlist permissions', err);
            return { data: {} as PlaylistData };
        });
    isEditable = !!data.CanEdit;

    const elem = page.querySelector('#childrenContent .itemsContainer');
    elem!.classList.add('vertical-list');
    elem!.classList.remove('vertical-wrap');
    (elem as any).enableDragReordering(isEditable);
    (elem as any).fetchData = getFetchPlaylistItemsFn(apiClient, item.Id);
    (elem as any).getItemsHtml = getItemsHtmlFn(item.Id, isEditable);
}

function refresh(page: HTMLElement): void {
    page.querySelector('#childrenContent')!.classList.add('verticalSection-extrabottompadding');
    (page.querySelector('#childrenContent .itemsContainer') as any).refreshItems();
}

function render(page: any, item: PlaylistItem): void {
    if (!page.playlistInit) {
        page.playlistInit = true;
        init(page, item)
            .finally(() => {
                refresh(page);
            });
    } else {
        refresh(page);
    }
}

const PlaylistViewer = {
    render
};

export default PlaylistViewer;
