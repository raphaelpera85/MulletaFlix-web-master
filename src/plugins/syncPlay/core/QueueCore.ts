import globalize from '../../../lib/globalize';
import toast from '../../../components/toast/toast';
import * as Helper from './Helper';

class QueueCore {
    private manager: any;

    private lastPlayQueueUpdate: any;

    private playlist: any[];

    constructor() {
        this.manager = null;
        this.lastPlayQueueUpdate = null;
        this.playlist = [];
    }

    init(syncPlayManager: any): void {
        this.manager = syncPlayManager;
    }

    updatePlayQueue(apiClient: any, newPlayQueue: any): void {
        newPlayQueue.LastUpdate = new Date(newPlayQueue.LastUpdate);

        if (newPlayQueue.LastUpdate.getTime() <= this.getLastUpdateTime()) {
            console.debug('SyncPlay updatePlayQueue: ignoring old update', newPlayQueue);
            return;
        }

        console.debug('SyncPlay updatePlayQueue:', newPlayQueue);

        const serverId = apiClient.serverInfo().Id;

        this.onPlayQueueUpdate(apiClient, newPlayQueue, serverId).then((previous: any) => {
            if (newPlayQueue.LastUpdate.getTime() < this.getLastUpdateTime()) {
                console.warn('SyncPlay updatePlayQueue: trying to apply old update.', newPlayQueue);
                throw new Error('Trying to apply old update');
            }

            if (this.manager.isRemote()) {
                console.warn('SyncPlay updatePlayQueue: remote player has own SyncPlay manager.');
                return;
            }

            const playerWrapper = this.manager.getPlayerWrapper();

            switch (newPlayQueue.Reason) {
                case 'NewPlaylist': {
                    if (!this.manager.isFollowingGroupPlayback()) {
                        this.manager.followGroupPlayback(apiClient).then(() => {
                            this.startPlayback(apiClient);
                        });
                    } else {
                        this.startPlayback(apiClient);
                    }
                    break;
                }
                case 'SetCurrentItem':
                case 'NextItem':
                case 'PreviousItem': {
                    playerWrapper.onQueueUpdate();

                    const playlistItemId = this.getCurrentPlaylistItemId();
                    this.setCurrentPlaylistItem(apiClient, playlistItemId);
                    break;
                }
                case 'RemoveItems': {
                    playerWrapper.onQueueUpdate();

                    const index = previous.playQueueUpdate.PlayingItemIndex;
                    const oldPlaylistItemId = index === -1 ? null : previous.playlist[index].PlaylistItemId;
                    const playlistItemId = this.getCurrentPlaylistItemId();
                    if (oldPlaylistItemId !== playlistItemId) {
                        this.setCurrentPlaylistItem(apiClient, playlistItemId);
                    }
                    break;
                }
                case 'MoveItem':
                case 'Queue':
                case 'QueueNext': {
                    playerWrapper.onQueueUpdate();
                    break;
                }
                case 'RepeatMode':
                    playerWrapper.localSetRepeatMode(this.getRepeatMode());
                    break;
                case 'ShuffleMode':
                    playerWrapper.localSetQueueShuffleMode(this.getShuffleMode());
                    break;
                default:
                    console.error('SyncPlay updatePlayQueue: unknown reason for update:', newPlayQueue.Reason);
                    break;
            }
        }).catch((error: any) => {
            console.warn('SyncPlay updatePlayQueue:', error);
        });
    }

    onPlayQueueUpdate(apiClient: any, playQueueUpdate: any, serverId: string): Promise<any> {
        const oldPlayQueueUpdate = this.lastPlayQueueUpdate;
        const oldPlaylist = this.playlist;

        const itemIds = playQueueUpdate.Playlist.map((queueItem: any) => queueItem.ItemId);

        if (!itemIds.length) {
            if (this.lastPlayQueueUpdate && playQueueUpdate.LastUpdate.getTime() <= this.getLastUpdateTime()) {
                return Promise.reject(new Error('Trying to apply old update'));
            }

            this.lastPlayQueueUpdate = playQueueUpdate;
            this.playlist = [];

            return Promise.resolve({
                playQueueUpdate: oldPlayQueueUpdate,
                playlist: oldPlaylist
            });
        }

        return Helper.getItemsForPlayback(apiClient, {
            Ids: itemIds.join(',')
        }).then((result: any) => {
            return Helper.translateItemsForPlayback(apiClient, result.Items, {
                ids: itemIds,
                serverId: serverId
            }).then((items: any[]) => {
                if (this.lastPlayQueueUpdate && playQueueUpdate.LastUpdate.getTime() <= this.getLastUpdateTime()) {
                    throw new Error('Trying to apply old update');
                }

                for (let i = 0; i < items.length; i++) {
                    items[i].PlaylistItemId = playQueueUpdate.Playlist[i].PlaylistItemId;
                }

                this.lastPlayQueueUpdate = playQueueUpdate;
                this.playlist = items;

                return {
                    playQueueUpdate: oldPlayQueueUpdate,
                    playlist: oldPlaylist
                };
            });
        });
    }

    scheduleReadyRequestOnPlaybackStart(apiClient: any, origin: string): void {
        Helper.waitForEventOnce(this.manager, 'playbackstart', Helper.WaitForEventDefaultTimeout, ['playbackerror']).then(async () => {
            console.debug('SyncPlay scheduleReadyRequestOnPlaybackStart: local pause and notify server.');
            const playerWrapper = this.manager.getPlayerWrapper();
            playerWrapper.localPause();

            const currentTime = new Date();
            const now = this.manager.timeSyncCore.localDateToRemote(currentTime);
            const currentPosition = (playerWrapper.currentTimeAsync ?
                await playerWrapper.currentTimeAsync() :
                playerWrapper.currentTime());
            const currentPositionTicks = Math.round(currentPosition * Helper.TicksPerMillisecond);
            const isPlaying = playerWrapper.isPlaying();

            apiClient.requestSyncPlayReady({
                When: now.toISOString(),
                PositionTicks: currentPositionTicks,
                IsPlaying: isPlaying,
                PlaylistItemId: this.getCurrentPlaylistItemId()
            });
        }).catch((error: any) => {
            console.error('Error while waiting for `playbackstart` event!', origin, error);
            if (!this.manager.isSyncPlayEnabled()) {
                toast(globalize.translate('MessageSyncPlayErrorMedia'));
            }

            this.manager.haltGroupPlayback(apiClient);
        });
    }

    startPlayback(apiClient: any): Promise<any> | undefined {
        if (!this.manager.isFollowingGroupPlayback()) {
            console.debug('SyncPlay startPlayback: ignoring, not following playback.');
            return Promise.reject();
        }

        if (this.isPlaylistEmpty()) {
            console.debug('SyncPlay startPlayback: empty playlist.');
            return;
        }

        const playbackCommand = this.manager.getLastPlaybackCommand();
        let startPositionTicks = 0;

        if (playbackCommand && playbackCommand.EmittedAt.getTime() >= this.getLastUpdateTime()) {
            startPositionTicks = this.manager.getPlaybackCore().estimateCurrentTicks(playbackCommand.PositionTicks, playbackCommand.When);
        } else {
            const oldStartPositionTicks = this.getStartPositionTicks();
            const lastQueueUpdateDate = this.getLastUpdate();
            startPositionTicks = this.manager.getPlaybackCore().estimateCurrentTicks(oldStartPositionTicks, lastQueueUpdateDate);
        }

        const serverId = apiClient.serverInfo().Id;

        this.scheduleReadyRequestOnPlaybackStart(apiClient, 'startPlayback');

        const playerWrapper = this.manager.getPlayerWrapper();
        playerWrapper.localPlay({
            ids: this.getPlaylistAsItemIds(),
            startPositionTicks: startPositionTicks,
            startIndex: this.getCurrentPlaylistIndex(),
            serverId: serverId
        }).catch((error: any) => {
            console.error(error);
            toast(globalize.translate('MessageSyncPlayErrorMedia'));
        });
    }

    setCurrentPlaylistItem(apiClient: any, playlistItemId: string | null): void {
        if (!this.manager.isFollowingGroupPlayback()) {
            console.debug('SyncPlay setCurrentPlaylistItem: ignoring, not following playback.');
            return;
        }

        if (playlistItemId == null) {
            return;
        }

        this.scheduleReadyRequestOnPlaybackStart(apiClient, 'setCurrentPlaylistItem');

        const playerWrapper = this.manager.getPlayerWrapper();
        playerWrapper.localSetCurrentPlaylistItem(playlistItemId);
    }

    getCurrentPlaylistIndex(): number {
        if (this.lastPlayQueueUpdate) {
            return this.lastPlayQueueUpdate.PlayingItemIndex;
        }

        return -1;
    }

    getCurrentPlaylistItemId(): string | null {
        if (this.lastPlayQueueUpdate) {
            const index = this.lastPlayQueueUpdate.PlayingItemIndex;
            return index === -1 ? null : this.playlist[index].PlaylistItemId;
        }

        return null;
    }

    getPlaylist(): any[] {
        return this.playlist.slice(0);
    }

    isPlaylistEmpty(): boolean {
        return this.playlist.length === 0;
    }

    getLastUpdate(): Date | null {
        if (this.lastPlayQueueUpdate) {
            return this.lastPlayQueueUpdate.LastUpdate;
        }

        return null;
    }

    getLastUpdateTime(): number {
        if (this.lastPlayQueueUpdate) {
            return this.lastPlayQueueUpdate.LastUpdate.getTime();
        }

        return 0;
    }

    getStartPositionTicks(): number {
        if (this.lastPlayQueueUpdate) {
            return this.lastPlayQueueUpdate.StartPositionTicks;
        }

        return 0;
    }

    getPlaylistAsItemIds(): any[] {
        if (this.lastPlayQueueUpdate) {
            return this.lastPlayQueueUpdate.Playlist.map((queueItem: any) => queueItem.ItemId);
        }

        return [];
    }

    getRepeatMode(): string {
        if (this.lastPlayQueueUpdate) {
            return this.lastPlayQueueUpdate.RepeatMode;
        }

        return 'Sorted';
    }

    getShuffleMode(): string {
        if (this.lastPlayQueueUpdate) {
            return this.lastPlayQueueUpdate.ShuffleMode;
        }

        return 'RepeatNone';
    }
}

export default QueueCore;
