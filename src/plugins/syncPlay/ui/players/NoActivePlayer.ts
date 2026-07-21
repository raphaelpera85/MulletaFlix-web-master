import { playbackManager } from '../../../../components/playback/playbackmanager';
import SyncPlay from '../../core';
import QueueManager from './QueueManager';
import GenericPlayer from '../../core/players/GenericPlayer';

const pm: any = playbackManager;
let syncPlayManager: any;

type SyncPlayCommand = {
    Name: string;
    Arguments?: {
        RepeatMode?: string;
        ShuffleMode?: string;
    };
};

class NoActivePlayer extends GenericPlayer {
    static type = 'default';

    constructor(player: any, _syncPlayManager: any) {
        super(player, _syncPlayManager);
        syncPlayManager = _syncPlayManager;
    }

    localBindToPlayer(): void {
        if (pm.syncPlayEnabled) return;

        pm._localPlayPause = pm.playPause;
        pm._localUnpause = pm.unpause;
        pm._localPause = pm.pause;
        pm._localSeek = pm.seek;
        pm._localSendCommand = pm.sendCommand;

        pm.playPause = this.playPauseRequest;
        pm.unpause = this.unpauseRequest;
        pm.pause = this.pauseRequest;
        pm.seek = this.seekRequest;
        pm.sendCommand = this.sendCommandRequest;

        pm._localPlayQueueManager = pm._playQueueManager;

        pm._localPlay = pm.play;
        pm._localSetCurrentPlaylistItem = pm.setCurrentPlaylistItem;
        pm._localClearQueue = pm.clearQueue;
        pm._localRemoveFromPlaylist = pm.removeFromPlaylist;
        pm._localMovePlaylistItem = pm.movePlaylistItem;
        pm._localQueue = pm.queue;
        pm._localQueueNext = pm.queueNext;

        pm._localNextTrack = pm.nextTrack;
        pm._localPreviousTrack = pm.previousTrack;

        pm._localSetRepeatMode = pm.setRepeatMode;
        pm._localSetQueueShuffleMode = pm.setQueueShuffleMode;
        pm._localToggleQueueShuffleMode = pm.toggleQueueShuffleMode;

        pm._playQueueManager = new QueueManager(this.manager as any);

        pm.play = this.playRequest;
        pm.setCurrentPlaylistItem = this.setCurrentPlaylistItemRequest;
        pm.clearQueue = this.clearQueueRequest;
        pm.removeFromPlaylist = this.removeFromPlaylistRequest;
        pm.movePlaylistItem = this.movePlaylistItemRequest;
        pm.queue = this.queueRequest;
        pm.queueNext = this.queueNextRequest;

        pm.nextTrack = this.nextTrackRequest;
        pm.previousTrack = this.previousTrackRequest;

        pm.setRepeatMode = this.setRepeatModeRequest;
        pm.setQueueShuffleMode = this.setQueueShuffleModeRequest;
        pm.toggleQueueShuffleMode = this.toggleQueueShuffleModeRequest;

        pm.syncPlayEnabled = true;
    }

    localUnbindFromPlayer(): void {
        if (!pm.syncPlayEnabled) return;

        pm.playPause = pm._localPlayPause;
        pm.unpause = pm._localUnpause;
        pm.pause = pm._localPause;
        pm.seek = pm._localSeek;
        pm.sendCommand = pm._localSendCommand;

        pm._playQueueManager = pm._localPlayQueueManager;

        pm.play = pm._localPlay;
        pm.setCurrentPlaylistItem = pm._localSetCurrentPlaylistItem;
        pm.clearQueue = pm._localClearQueue;
        pm.removeFromPlaylist = pm._localRemoveFromPlaylist;
        pm.movePlaylistItem = pm._localMovePlaylistItem;
        pm.queue = pm._localQueue;
        pm.queueNext = pm._localQueueNext;

        pm.nextTrack = pm._localNextTrack;
        pm.previousTrack = pm._localPreviousTrack;

        pm.setRepeatMode = pm._localSetRepeatMode;
        pm.setQueueShuffleMode = pm._localSetQueueShuffleMode;
        pm.toggleQueueShuffleMode = pm._localToggleQueueShuffleMode;

        pm.syncPlayEnabled = false;
    }

    playPauseRequest(): void {
        const controller = syncPlayManager.getController();
        controller.playPause();
    }

    unpauseRequest(): void {
        const controller = syncPlayManager.getController();
        controller.unpause();
    }

    pauseRequest(): void {
        const controller = syncPlayManager.getController();
        controller.pause();
    }

    seekRequest(positionTicks: number): void {
        const controller = syncPlayManager.getController();
        controller.seek(positionTicks);
    }

    sendCommandRequest(command: SyncPlayCommand, player: any): void {
        console.debug('SyncPlay sendCommand:', command.Name, command);
        const controller = syncPlayManager.getController();
        const playerWrapper = syncPlayManager.getPlayerWrapper();

        const defaultAction = (_command: SyncPlayCommand): void => {
            playerWrapper.localSendCommand(_command);
        };

        const ignoreCallback = (): void => {
            // Do nothing.
        };

        const SetRepeatModeCallback = (_command: SyncPlayCommand): void => {
            controller.setRepeatMode(_command.Arguments!.RepeatMode!);
        };

        const SetShuffleQueueCallback = (_command: SyncPlayCommand): void => {
            controller.setShuffleMode(_command.Arguments!.ShuffleMode!);
        };

        const overrideCommands: Record<string, (command: SyncPlayCommand) => void> = {
            PlaybackRate: ignoreCallback,
            SetRepeatMode: SetRepeatModeCallback,
            SetShuffleQueue: SetShuffleQueueCallback
        };

        const commandHandler = overrideCommands[command.Name];
        if (typeof commandHandler === 'function') {
            commandHandler(command);
        } else {
            defaultAction(command);
        }
    }

    localUnpause(): void {
        if (pm.syncPlayEnabled) {
            pm._localUnpause(this.player);
        } else {
            pm.unpause(this.player);
        }
    }

    localPause(): void {
        if (pm.syncPlayEnabled) {
            pm._localPause(this.player);
        } else {
            pm.pause(this.player);
        }
    }

    localSeek(positionTicks: number): void {
        if (pm.syncPlayEnabled) {
            pm._localSeek(positionTicks, this.player);
        } else {
            pm.seek(positionTicks, this.player);
        }
    }

    localStop(): void {
        pm.stop(this.player);
    }

    localSendCommand(cmd: { Name: string }): void {
        if (pm.syncPlayEnabled) {
            pm._localSendCommand(cmd, this.player);
        } else {
            pm.sendCommand(cmd, this.player);
        }
    }

    playRequest(options: any): any {
        const controller = syncPlayManager.getController();
        return controller.play(options);
    }

    setCurrentPlaylistItemRequest(playlistItemId: string): void {
        syncPlayManager.getController().setCurrentPlaylistItem(playlistItemId);
    }

    clearQueueRequest(clearPlayingItem: boolean): void {
        syncPlayManager.getController().clearPlaylist(clearPlayingItem);
    }

    removeFromPlaylistRequest(playlistItemIds: string[]): void {
        syncPlayManager.getController().removeFromPlaylist(playlistItemIds);
    }

    movePlaylistItemRequest(playlistItemId: string, newIndex: number): void {
        syncPlayManager.getController().movePlaylistItem(playlistItemId, newIndex);
    }

    queueRequest(options: any): void {
        syncPlayManager.getController().queue(options);
    }

    queueNextRequest(options: any): void {
        syncPlayManager.getController().queueNext(options);
    }

    nextTrackRequest(): void {
        syncPlayManager.getController().nextItem();
    }

    previousTrackRequest(): void {
        syncPlayManager.getController().previousItem();
    }

    setRepeatModeRequest(mode: string): void {
        syncPlayManager.getController().setRepeatMode(mode);
    }

    setQueueShuffleModeRequest(mode: string): void {
        syncPlayManager.getController().setShuffleMode(mode);
    }

    toggleQueueShuffleModeRequest(): void {
        syncPlayManager.getController().toggleShuffleMode();
    }

    localPlay(options: any): any {
        if (pm.syncPlayEnabled) {
            return pm._localPlay(options);
        }

        return pm.play(options);
    }

    localSetCurrentPlaylistItem(playlistItemId: string): any {
        if (pm.syncPlayEnabled) {
            return pm._localSetCurrentPlaylistItem(playlistItemId, this.player);
        }

        return pm.setCurrentPlaylistItem(playlistItemId, this.player);
    }

    localRemoveFromPlaylist(playlistItemIds: string[]): any {
        if (pm.syncPlayEnabled) {
            return pm._localRemoveFromPlaylist(playlistItemIds, this.player);
        }

        return pm.removeFromPlaylist(playlistItemIds, this.player);
    }

    localMovePlaylistItem(playlistItemId: string, newIndex: number): any {
        if (pm.syncPlayEnabled) {
            return pm._localMovePlaylistItem(playlistItemId, newIndex, this.player);
        }

        return pm.movePlaylistItem(playlistItemId, newIndex, this.player);
    }

    localQueue(options: any): any {
        if (pm.syncPlayEnabled) {
            return pm._localQueue(options, this.player);
        }

        return pm.queue(options, this.player);
    }

    localQueueNext(options: any): any {
        if (pm.syncPlayEnabled) {
            return pm._localQueueNext(options, this.player);
        }

        return pm.queueNext(options, this.player);
    }

    localNextItem(): void {
        if (pm.syncPlayEnabled) {
            pm._localNextTrack(this.player);
        } else {
            pm.nextTrack(this.player);
        }
    }

    localPreviousItem(): void {
        if (pm.syncPlayEnabled) {
            pm._localPreviousTrack(this.player);
        } else {
            pm.previousTrack(this.player);
        }
    }

    localSetRepeatMode(value: string): void {
        if (pm.syncPlayEnabled) {
            pm._localSetRepeatMode(value, this.player);
        } else {
            pm.setRepeatMode(value, this.player);
        }
    }

    localSetQueueShuffleMode(value: string): void {
        if (pm.syncPlayEnabled) {
            pm._localSetQueueShuffleMode(value, this.player);
        } else {
            pm.setQueueShuffleMode(value, this.player);
        }
    }

    localToggleQueueShuffleMode(): void {
        if (pm.syncPlayEnabled) {
            pm._localToggleQueueShuffleMode(this.player);
        } else {
            pm.toggleQueueShuffleMode(this.player);
        }
    }
}

export default NoActivePlayer;
