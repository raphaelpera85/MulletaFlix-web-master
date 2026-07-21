import { randomInt } from '../../utils/number.ts';

let currentId = 0;

function addUniquePlaylistItemId(item: any): void {
    if (!item.PlaylistItemId) {
        item.PlaylistItemId = `playlistItem${currentId}`;
        currentId++;
    }
}

function findPlaylistIndex(playlistItemId: string | null, list: any[]): number {
    for (let i = 0, length = list.length; i < length; i++) {
        if (list[i].PlaylistItemId === playlistItemId) {
            return i;
        }
    }

    return -1;
}

class PlayQueueManager {
    private _sortedPlaylist: any[];

    private _playlist: any[];

    private _repeatMode: string;

    private _shuffleMode: string;

    private _currentPlaylistItemId: string | null;

    constructor() {
        this._sortedPlaylist = [];
        this._playlist = [];
        this._repeatMode = 'RepeatNone';
        this._shuffleMode = 'Sorted';
        this._currentPlaylistItemId = null;
    }

    getPlaylist(): any[] {
        return this._playlist.slice(0);
    }

    setPlaylist(items: any[]): void {
        items = items.slice(0);

        for (let i = 0, length = items.length; i < length; i++) {
            addUniquePlaylistItemId(items[i]);
        }

        this._currentPlaylistItemId = null;
        this._playlist = items;
        this._repeatMode = 'RepeatNone';
    }

    queue(items: any[]): void {
        for (let i = 0, length = items.length; i < length; i++) {
            addUniquePlaylistItemId(items[i]);
            this._playlist.push(items[i]);
        }
    }

    shufflePlaylist(): void {
        this._sortedPlaylist = [];
        for (const item of this._playlist) {
            this._sortedPlaylist.push(item);
        }

        const currentPlaylistItem = this._playlist.splice(this.getCurrentPlaylistIndex(), 1)[0];

        for (let i = this._playlist.length - 1; i > 0; i--) {
            const j = randomInt(0, i - 1);
            const temp = this._playlist[i];
            this._playlist[i] = this._playlist[j];
            this._playlist[j] = temp;
        }

        this._playlist.unshift(currentPlaylistItem);
        this._shuffleMode = 'Shuffle';
    }

    sortShuffledPlaylist(): void {
        this._playlist = [];
        for (const item of this._sortedPlaylist) {
            this._playlist.push(item);
        }
        this._sortedPlaylist = [];
        this._shuffleMode = 'Sorted';
    }

    clearPlaylist(clearCurrentItem = false): void {
        const currentPlaylistItem = this._playlist.splice(this.getCurrentPlaylistIndex(), 1)[0];
        this._playlist = [];
        if (!clearCurrentItem) {
            this._playlist.push(currentPlaylistItem);
        }
    }

    queueNext(items: any[]): void {
        for (let i = 0, length = items.length; i < length; i++) {
            addUniquePlaylistItemId(items[i]);
        }

        let currentIndex = this.getCurrentPlaylistIndex();

        if (currentIndex === -1) {
            currentIndex = this._playlist.length;
        } else {
            currentIndex++;
        }

        arrayInsertAt(this._playlist, currentIndex, items);
    }

    getCurrentPlaylistIndex(): number {
        return findPlaylistIndex(this.getCurrentPlaylistItemId(), this._playlist);
    }

    getCurrentItem(): any | null {
        const index = findPlaylistIndex(this.getCurrentPlaylistItemId(), this._playlist);
        return index === -1 ? null : this._playlist[index];
    }

    getCurrentPlaylistItemId(): string | null {
        return this._currentPlaylistItemId;
    }

    setPlaylistState(playlistItemId: string | null): void {
        this._currentPlaylistItemId = playlistItemId;
    }

    setPlaylistIndex(playlistIndex: number): void {
        if (playlistIndex < 0) {
            this.setPlaylistState(null);
        } else {
            this.setPlaylistState(this._playlist[playlistIndex].PlaylistItemId);
        }
    }

    removeFromPlaylist(playlistItemIds: string[]): { result: string; isCurrentIndex?: boolean } {
        if (this._playlist.length <= playlistItemIds.length) {
            return {
                result: 'empty'
            };
        }

        const currentPlaylistItemId = this.getCurrentPlaylistItemId();
        const isCurrentIndex = playlistItemIds.indexOf(currentPlaylistItemId as string) !== -1;

        this._sortedPlaylist = this._sortedPlaylist.filter((item) => {
            return !playlistItemIds.includes(item.PlaylistItemId);
        });

        this._playlist = this._playlist.filter((item) => {
            return !playlistItemIds.includes(item.PlaylistItemId);
        });

        return {
            result: 'removed',
            isCurrentIndex: isCurrentIndex
        };
    }

    movePlaylistItem(playlistItemId: string, newIndex: number): { result: string; playlistItemId?: string; newIndex?: number } {
        const playlist = this.getPlaylist();

        let oldIndex = -1;
        for (let i = 0, length = playlist.length; i < length; i++) {
            if (playlist[i].PlaylistItemId === playlistItemId) {
                oldIndex = i;
                break;
            }
        }

        if (oldIndex === -1 || oldIndex === newIndex) {
            return {
                result: 'noop'
            };
        }

        if (newIndex >= playlist.length) {
            throw new Error('newIndex out of bounds');
        }

        moveInArray(playlist, oldIndex, newIndex);
        this._playlist = playlist;

        return {
            result: 'moved',
            playlistItemId: playlistItemId,
            newIndex: newIndex
        };
    }

    reset(): void {
        this._sortedPlaylist = [];
        this._playlist = [];
        this._currentPlaylistItemId = null;
        this._repeatMode = 'RepeatNone';
        this._shuffleMode = 'Sorted';
    }

    setRepeatMode(value: string): void {
        const repeatModes = ['RepeatOne', 'RepeatAll', 'RepeatNone'];
        if (repeatModes.includes(value)) {
            this._repeatMode = value;
        } else {
            throw new TypeError('invalid value provided for setRepeatMode');
        }
    }

    getRepeatMode(): string {
        return this._repeatMode;
    }

    setShuffleMode(value: string): void {
        switch (value) {
            case 'Shuffle':
                this.shufflePlaylist();
                break;
            case 'Sorted':
                this.sortShuffledPlaylist();
                break;
            default:
                throw new TypeError('invalid value provided to setShuffleMode');
        }
    }

    toggleShuffleMode(): void {
        switch (this._shuffleMode) {
            case 'Shuffle':
                this.setShuffleMode('Sorted');
                break;
            case 'Sorted':
                this.setShuffleMode('Shuffle');
                break;
            default:
                throw new TypeError('current value for shufflequeue is invalid');
        }
    }

    getShuffleMode(): string {
        return this._shuffleMode;
    }

    getNextItemInfo(): { item: any; index: number } | null {
        let newIndex;
        const playlist = this.getPlaylist();
        const playlistLength = playlist.length;

        switch (this.getRepeatMode()) {
            case 'RepeatOne':
                newIndex = this.getCurrentPlaylistIndex();
                break;
            case 'RepeatAll':
                newIndex = this.getCurrentPlaylistIndex() + 1;
                if (newIndex >= playlistLength) {
                    newIndex = 0;
                }
                break;
            default:
                newIndex = this.getCurrentPlaylistIndex() + 1;
                break;
        }

        if (newIndex < 0 || newIndex >= playlistLength) {
            return null;
        }

        const item = playlist[newIndex];
        if (!item) {
            return null;
        }

        return {
            item: item,
            index: newIndex
        };
    }
}

function arrayInsertAt(destArray: any[], pos: number, arrayToInsert: any[]): void {
    destArray.splice(pos, 0, ...arrayToInsert);
}

function moveInArray(array: any[], from: number, to: number): void {
    array.splice(to, 0, array.splice(from, 1)[0]);
}

export default PlayQueueManager;
