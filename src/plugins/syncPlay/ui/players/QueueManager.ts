interface PlaylistItem {
    PlaylistItemId?: string;
    [key: string]: string | number | boolean | null | undefined | PlaylistItem[] | PlaylistItem;
}

interface QueueCoreLike {
    getPlaylist(): PlaylistItem[];
    getCurrentPlaylistIndex(): number;
    getCurrentPlaylistItemId(): string | null;
    getRepeatMode(): string;
    getShuffleMode(): boolean;
}

interface SyncPlayManagerLike {
    getQueueCore(): QueueCoreLike;
}

class QueueManager {
    private queueCore: QueueCoreLike;

    constructor(syncPlayManager: SyncPlayManagerLike) {
        this.queueCore = syncPlayManager.getQueueCore();
    }

    getPlaylist(): PlaylistItem[] {
        return this.queueCore.getPlaylist();
    }

    setPlaylist(): void {
        // Do nothing.
    }

    queue(): void {
        // Do nothing.
    }

    shufflePlaylist(): void {
        // Do nothing.
    }

    sortShuffledPlaylist(): void {
        // Do nothing.
    }

    clearPlaylist(): void {
        // Do nothing.
    }

    queueNext(): void {
        // Do nothing.
    }

    getCurrentPlaylistIndex(): number {
        return this.queueCore.getCurrentPlaylistIndex();
    }

    getCurrentItem(): PlaylistItem | null {
        const index = this.getCurrentPlaylistIndex();
        if (index >= 0) {
            const playlist = this.getPlaylist();
            return playlist[index] || null;
        }

        return null;
    }

    getCurrentPlaylistItemId(): string | null {
        return this.queueCore.getCurrentPlaylistItemId();
    }

    setPlaylistState(): void {
        // Do nothing.
    }

    setPlaylistIndex(): void {
        // Do nothing.
    }

    removeFromPlaylist(): void {
        // Do nothing.
    }

    movePlaylistItem(): { result: string } {
        // Do nothing.
        return {
            result: 'noop'
        };
    }

    reset(): void {
        // Do nothing.
    }

    setRepeatMode(): void {
        // Do nothing.
    }

    getRepeatMode(): string {
        return this.queueCore.getRepeatMode();
    }

    setShuffleMode(): void {
        // Do nothing.
    }

    toggleShuffleMode(): void {
        // Do nothing.
    }

    getShuffleMode(): boolean {
        return this.queueCore.getShuffleMode();
    }

    getNextItemInfo(): { item: PlaylistItem; index: number } | null {
        const playlist = this.getPlaylist();
        let newIndex: number;

        switch (this.getRepeatMode()) {
            case 'RepeatOne':
                newIndex = this.getCurrentPlaylistIndex();
                break;
            case 'RepeatAll':
                newIndex = this.getCurrentPlaylistIndex() + 1;
                if (newIndex >= playlist.length) {
                    newIndex = 0;
                }
                break;
            default:
                newIndex = this.getCurrentPlaylistIndex() + 1;
                break;
        }

        if (newIndex < 0 || newIndex >= playlist.length) {
            return null;
        }

        const item = playlist[newIndex];
        if (!item) {
            return null;
        }

        return {
            item,
            index: newIndex
        };
    }
}

export default QueueManager;
