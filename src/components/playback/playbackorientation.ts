import { playbackManager } from './playbackmanager';
import layoutManager from '../layoutManager';
import Events from '../../utils/events.ts';

interface PlaybackPlayerContract {
    isLocalPlayer: boolean;
    isExternalPlayer?: boolean;
}

interface PlaybackStopInfo {
    nextMediaType?: string;
}

interface PlaybackManagerContract {
    isPlayingVideo(player: PlaybackPlayerContract): boolean;
    getCurrentPlayer(): PlaybackPlayerContract | null;
}

interface OrientationScreen {
    lockOrientation?: (orientation: string) => Promise<unknown> | boolean;
    mozLockOrientation?: (orientation: string) => Promise<unknown> | boolean;
    msLockOrientation?: (orientation: string) => Promise<unknown> | boolean;
    unlockOrientation?: () => void;
    mozUnlockOrientation?: () => void;
    msUnlockOrientation?: () => void;
    orientation?: ScreenOrientation & {
        lock?: (orientation: string) => Promise<unknown> | boolean;
        unlock?: () => void;
    };
}

let orientationLocked: boolean | undefined;

function onOrientationChangeSuccess(): void {
    orientationLocked = true;
}

function onOrientationChangeError(err: unknown): void {
    orientationLocked = false;
    console.error('error locking orientation: ' + err);
}

Events.on(playbackManager, 'playbackstart', function (_e: unknown, player: PlaybackPlayerContract) {
    const isLocalVideo = player.isLocalPlayer && !player.isExternalPlayer && (playbackManager as unknown as PlaybackManagerContract).isPlayingVideo(player);

    if (isLocalVideo && layoutManager.mobile) {
        const screen = window.screen as OrientationScreen;
        const lockOrientation = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation || screen.orientation?.lock;

        if (lockOrientation) {
            try {
                const promise = lockOrientation('landscape');
                if (typeof (promise as Promise<unknown>).then === 'function') {
                    (promise as Promise<unknown>).then(onOrientationChangeSuccess, onOrientationChangeError);
                } else {
                    orientationLocked = promise as boolean;
                }
            } catch (err) {
                onOrientationChangeError(err);
            }
        }
    }
});

Events.on(playbackManager, 'playbackstop', function (_e: unknown, playbackStopInfo: PlaybackStopInfo) {
    if (orientationLocked && !playbackStopInfo.nextMediaType) {
        const screen = window.screen as OrientationScreen;
        const unlockOrientation = screen.unlockOrientation || screen.mozUnlockOrientation || screen.msUnlockOrientation || screen.orientation?.unlock;

        if (unlockOrientation) {
            try {
                unlockOrientation();
            } catch (err) {
                console.error('error unlocking orientation: ' + err);
            }
            orientationLocked = false;
        }
    }
});
