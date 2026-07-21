import { playbackManager } from '../playback/playbackmanager';
import Events from '../../utils/events.ts';

interface PlaybackItem {
    Id: string;
    ServerId?: string;
}

interface PlaybackState {
    NowPlayingItem?: PlaybackItem;
    PlayState?: {
        PositionTicks?: number;
    };
}

interface PlaybackPlayer {
    isLocalPlayer: boolean;
}

interface PlaybackManagerContract {
    getPlayerState(player: PlaybackPlayer): PlaybackState;
    getPlaylist(player: PlaybackPlayer): Promise<Array<{ Id: string }>>;
    stop(player: PlaybackPlayer): Promise<void>;
    play(options: {
        ids: string[];
        serverId?: string;
        startPositionTicks: number;
        startIndex: number;
    }, player: PlaybackPlayer): void;
}

function transferPlayback(oldPlayer: PlaybackPlayer, newPlayer: PlaybackPlayer): void {
    const state = (playbackManager as unknown as PlaybackManagerContract).getPlayerState(oldPlayer);
    const item = state.NowPlayingItem;

    if (!item) {
        return;
    }

    (playbackManager as unknown as PlaybackManagerContract).getPlaylist(oldPlayer).then(playlist => {
        const playlistIds = playlist.map(x => x.Id);
        const playState = state.PlayState || {};
        const resumePositionTicks = playState.PositionTicks || 0;
        const playlistIndex = playlistIds.indexOf(item.Id) || 0;

        (playbackManager as unknown as PlaybackManagerContract).stop(oldPlayer).then(() => {
            (playbackManager as unknown as PlaybackManagerContract).play({
                ids: playlistIds,
                serverId: item.ServerId,
                startPositionTicks: resumePositionTicks,
                startIndex: playlistIndex
            }, newPlayer);
        });
    });
}

Events.on(playbackManager, 'playerchange', (_e: unknown, newPlayer: PlaybackPlayer, _newTarget: unknown, oldPlayer: PlaybackPlayer) => {
    if (!oldPlayer || !newPlayer) {
        return;
    }

    if (!oldPlayer.isLocalPlayer) {
        console.debug('Skipping remote control autoplay because oldPlayer is not a local player');
        return;
    }

    if (newPlayer.isLocalPlayer) {
        console.debug('Skipping remote control autoplay because newPlayer is a local player');
        return;
    }

    transferPlayback(oldPlayer, newPlayer);
});
