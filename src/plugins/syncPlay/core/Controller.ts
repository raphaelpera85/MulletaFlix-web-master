import * as Helper from './Helper';

class Controller {
    private manager: any;

    constructor() {
        this.manager = null;
    }

    init(syncPlayManager: any): void {
        this.manager = syncPlayManager;
    }

    playPause(): void {
        if (this.manager.isPlaying()) {
            this.pause();
        } else {
            this.unpause();
        }
    }

    unpause(): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayUnpause();
    }

    pause(): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayPause();

        const playerWrapper = this.manager.getPlayerWrapper();
        playerWrapper.localPause();
    }

    seek(positionTicks: number): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySeek({
            PositionTicks: positionTicks
        });
    }

    play(options: any): Promise<any> {
        const apiClient = this.manager.getApiClient();
        const sendPlayRequest = (items: Array<{ Id: string }>) => {
            const queue = items.map(item => item.Id);
            return apiClient.requestSyncPlaySetNewQueue({
                PlayingQueue: queue,
                PlayingItemPosition: options.startIndex ? options.startIndex : 0,
                StartPositionTicks: options.startPositionTicks ? options.startPositionTicks : 0
            });
        };

        if (options.items) {
            return Helper.translateItemsForPlayback(apiClient, options.items, options).then(sendPlayRequest);
        }

        return Helper.getItemsForPlayback(apiClient, {
            Ids: options.ids.join(',')
        }).then((result) => {
            return Helper.translateItemsForPlayback(apiClient, result.Items, options).then(sendPlayRequest);
        });
    }

    setCurrentPlaylistItem(playlistItemId: string): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySetPlaylistItem({
            PlaylistItemId: playlistItemId
        });
    }

    clearPlaylist(clearPlayingItem = false): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayRemoveFromPlaylist({
            ClearPlaylist: true,
            ClearPlayingItem: clearPlayingItem
        });
    }

    removeFromPlaylist(playlistItemIds: string[]): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayRemoveFromPlaylist({
            PlaylistItemIds: playlistItemIds
        });
    }

    movePlaylistItem(playlistItemId: string, newIndex: number): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayMovePlaylistItem({
            PlaylistItemId: playlistItemId,
            NewIndex: newIndex
        });
    }

    queue(options: any, mode = 'Queue'): void {
        const apiClient = this.manager.getApiClient();
        if (options.items) {
            Helper.translateItemsForPlayback(apiClient, options.items, options).then((items) => {
                const itemIds = items.map(item => item.Id);
                apiClient.requestSyncPlayQueue({
                    ItemIds: itemIds,
                    Mode: mode
                });
            });
        } else {
            Helper.getItemsForPlayback(apiClient, {
                Ids: options.ids.join(',')
            }).then((result) => {
                Helper.translateItemsForPlayback(apiClient, result.Items, options).then((items) => {
                    const itemIds = items.map(item => item.Id);
                    apiClient.requestSyncPlayQueue({
                        ItemIds: itemIds,
                        Mode: mode
                    });
                });
            });
        }
    }

    queueNext(options: any): void {
        this.queue(options, 'QueueNext');
    }

    nextItem(): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayNextItem({
            PlaylistItemId: this.manager.getQueueCore().getCurrentPlaylistItemId()
        });
    }

    previousItem(): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlayPreviousItem({
            PlaylistItemId: this.manager.getQueueCore().getCurrentPlaylistItemId()
        });
    }

    setRepeatMode(mode: string): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySetRepeatMode({
            Mode: mode
        });
    }

    setShuffleMode(mode: string): void {
        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySetShuffleMode({
            Mode: mode
        });
    }

    toggleShuffleMode(): void {
        let mode = this.manager.getQueueCore().getShuffleMode();
        mode = mode === 'Sorted' ? 'Shuffle' : 'Sorted';

        const apiClient = this.manager.getApiClient();
        apiClient.requestSyncPlaySetShuffleMode({
            Mode: mode
        });
    }
}

export default Controller;
