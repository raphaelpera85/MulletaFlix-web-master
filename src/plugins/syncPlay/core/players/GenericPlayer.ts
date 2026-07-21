import Events from '../../../../utils/events.ts';

interface PlaybackCoreLike {
    onPlaybackStart(player: SyncPlayPlayerLike, state: unknown): void;
    onPlaybackStop(stopInfo: unknown): void;
    onUnpause(): void;
    onPause(): void;
    onTimeUpdate(event: Event, timeUpdateData: unknown): void;
    onReady(): void;
    onBuffering(): void;
}

export interface SyncPlayPlayerLike {
    currentTimeAsync?: () => Promise<number>;
    currentTime(): number;
    getPlaybackRate(): number;
    setPlaybackRate(value: number): void;
    paused(): boolean;
}

export interface SyncPlayManagerLike {
    getPlaybackCore(): PlaybackCoreLike;
    getQueueCore(): object;
}

export default class GenericPlayer {
    static type = 'generic';

    player: SyncPlayPlayerLike;

    manager: SyncPlayManagerLike;

    playbackCore: PlaybackCoreLike;

    queueCore: object;

    bound = false;

    currentPlayer: SyncPlayPlayerLike | undefined;

    constructor(player: SyncPlayPlayerLike, syncPlayManager: SyncPlayManagerLike) {
        this.player = player;
        this.manager = syncPlayManager;
        this.playbackCore = syncPlayManager.getPlaybackCore();
        this.queueCore = syncPlayManager.getQueueCore();
    }

    bindToPlayer(): void {
        if (this.bound) {
            return;
        }

        this.localBindToPlayer();
        this.bound = true;
    }

    localBindToPlayer(): void {
        throw new Error('Override this method!');
    }

    unbindFromPlayer(): void {
        if (!this.bound) {
            return;
        }

        this.localUnbindFromPlayer();
        this.bound = false;
    }

    localUnbindFromPlayer(): void {
        throw new Error('Override this method!');
    }

    onPlaybackStart(player: SyncPlayPlayerLike, state: unknown): void {
        this.playbackCore.onPlaybackStart(player, state);
        Events.trigger(this, 'playbackstart', [player, state]);
    }

    onPlaybackStop(stopInfo: unknown): void {
        this.playbackCore.onPlaybackStop(stopInfo);
        Events.trigger(this, 'playbackstop', [stopInfo]);
    }

    onUnpause(): void {
        this.playbackCore.onUnpause();
        Events.trigger(this, 'unpause', [this.currentPlayer]);
    }

    onPause(): void {
        this.playbackCore.onPause();
        Events.trigger(this, 'pause', [this.currentPlayer]);
    }

    onTimeUpdate(event: Event, timeUpdateData: unknown): void {
        this.playbackCore.onTimeUpdate(event, timeUpdateData);
        Events.trigger(this, 'timeupdate', [event, timeUpdateData]);
    }

    onReady(): void {
        this.playbackCore.onReady();
        Events.trigger(this, 'ready');
    }

    onBuffering(): void {
        this.playbackCore.onBuffering();
        Events.trigger(this, 'buffering');
    }

    onQueueUpdate(): void {
        // Do nothing.
    }

    isPlaybackActive(): boolean {
        return false;
    }

    isPlaying(): boolean {
        return false;
    }

    currentTime(): number {
        return 0;
    }

    hasPlaybackRate(): boolean {
        return false;
    }

    setPlaybackRate(_value: number): void {
        // Do nothing.
    }

    getPlaybackRate(): number {
        return 1.0;
    }

    isRemote(): boolean {
        return false;
    }

    localUnpause(): void {
        // Override
    }

    localPause(): void {
        // Override
    }

    localSeek(_positionTicks: number): void {
        // Override
    }

    localStop(): void {
        // Override
    }

    localSendCommand(_command: unknown): void {
        // Override
    }

    localPlay(_options: unknown): void {
        // Override
    }

    localSetCurrentPlaylistItem(_playlistItemId: string): void {
        // Override
    }

    localRemoveFromPlaylist(_playlistItemIds: string[]): void {
        // Override
    }

    localMovePlaylistItem(_playlistItemId: string, _newIndex: number): void {
        // Override
    }

    localQueue(_options: unknown): void {
        // Override
    }

    localQueueNext(_options: unknown): void {
        // Override
    }

    localNextItem(): void {
        // Override
    }

    localPreviousItem(): void {
        // Override
    }

    localSetRepeatMode(_value: string): void {
        // Override
    }

    localSetQueueShuffleMode(_value: string): void {
        // Override
    }

    localToggleQueueShuffleMode(): void {
        // Override
    }
}
