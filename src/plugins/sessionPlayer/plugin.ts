import { playbackManager } from '../../components/playback/playbackmanager';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { PluginType } from '../../types/plugin.ts';
import Events from '../../utils/events.ts';
import isEqual from 'lodash-es/isEqual';
import { OutboundWebSocketMessageType, PeriodicListenerInterval } from '@jellyfin/sdk/lib/websocket';

interface PlayOptions {
    ids?: string[];
    items?: Array<{ Id: string; PlaylistItemId?: string }>;
    startPositionTicks?: number;
    mediaSourceId?: string;
    audioStreamIndex?: number | null;
    subtitleStreamIndex?: number | null;
    startIndex?: number;
    serverId?: string;
}

interface SessionState {
    Id?: string;
    NowPlayingItem?: Record<string, unknown>;
    PlayState?: {
        PositionTicks?: number;
        IsPaused?: boolean;
        IsMuted?: boolean;
        VolumeLevel?: number;
        RepeatMode?: unknown;
        OrderMode?: unknown;
        AudioStreamIndex?: number;
        SubtitleStreamIndex?: number;
        MaxStreamingBitrate?: number;
        BufferedRanges?: unknown[];
        IsFullscreen?: boolean;
    };
    TranscodingInfo?: {
        CompletionPercentage?: number;
        Framerate?: number;
        IsVideoDirect?: boolean;
    };
    PlaylistItemId?: string;
    NowPlayingQueue?: Array<{ Id: string; PlaylistItemId: string }>;
    LastActivityDate?: unknown;
    LastPlaybackCheckIn?: unknown;
    LastPausedDate?: unknown;
}

interface TargetInfo {
    name: string;
    deviceName: string;
    deviceType: string;
    id: string;
    playerName: string;
    appName: string;
    playableMediaTypes: string[];
    isLocalPlayer: boolean;
    supportedCommands: string[];
    user: { Id: string; Name: string; PrimaryImageTag: string } | null;
}

function getActivePlayerId(): string | null {
    const info = playbackManager.getPlayerInfo();
    return info ? info.id : null;
}

function sendPlayCommand(apiClient: any, options: PlayOptions, playType: string): Promise<void> {
    const sessionId = getActivePlayerId();

    const ids = options.ids || options.items!.map(function (i) {
        return i.Id;
    });

    const remoteOptions: Record<string, unknown> = {
        ItemIds: ids.join(','),

        PlayCommand: playType
    };

    if (options.startPositionTicks) {
        remoteOptions.StartPositionTicks = options.startPositionTicks;
    }

    if (options.mediaSourceId) {
        remoteOptions.MediaSourceId = options.mediaSourceId;
    }

    if (options.audioStreamIndex != null) {
        remoteOptions.AudioStreamIndex = options.audioStreamIndex;
    }

    if (options.subtitleStreamIndex != null) {
        remoteOptions.SubtitleStreamIndex = options.subtitleStreamIndex;
    }

    if (options.startIndex != null) {
        remoteOptions.StartIndex = options.startIndex;
    }

    return apiClient.sendPlayCommand(sessionId, remoteOptions);
}

function sendPlayStateCommand(apiClient: any, command: string, options?: Record<string, unknown>): void {
    const sessionId = getActivePlayerId();

    apiClient.sendPlayStateCommand(sessionId, command, options);
}

function getCurrentApiClient(instance: SessionPlayer): any {
    const currentServerId = instance.currentServerId;

    if (currentServerId) {
        return ServerConnections.getApiClient(currentServerId);
    }

    return ServerConnections.currentApiClient();
}

function sendCommandByName(instance: SessionPlayer, name: string, options?: Record<string, unknown>): void {
    const command: Record<string, unknown> = {
        Name: name
    };

    if (options) {
        command.Arguments = options;
    }

    instance.sendCommand(command);
}

function unsubscribeFromPlayerUpdates(instance: SessionPlayer): void {
    instance.isUpdating = true;

    if (instance._unsubscribeSessions) {
        instance._unsubscribeSessions();
        instance._unsubscribeSessions = null;
    }
}

async function updatePlaylist(instance: SessionPlayer, queue: Array<{ Id: string; PlaylistItemId: string }>): Promise<void> {
    const options = {
        ids: queue.map(i => i.Id),
        serverId: getCurrentApiClient(instance).serverId()
    };

    const result = await playbackManager.getItemsForPlayback(options.serverId, {
        Ids: options.ids.join(',')
    });

    const items = await playbackManager.translateItemsForPlayback(result.Items, options);

    for (let i = 0; i < items.length; i++) {
        items[i].PlaylistItemId = queue[i].PlaylistItemId;
    }

    instance.playlist = items;
}

function compareQueues(q1: Array<{ Id: string; PlaylistItemId: string }>, q2: Array<{ Id: string; PlaylistItemId: string }>): boolean {
    if (q1.length !== q2.length) {
        return true;
    }

    for (let i = 0; i < q1.length; i++) {
        if (q1[i].Id !== q2[i].Id || q1[i].PlaylistItemId !== q2[i].PlaylistItemId) {
            return true;
        }
    }
    return false;
}

function updateCurrentQueue(instance: SessionPlayer, session: SessionState): void {
    const current = session.NowPlayingQueue || [];
    if (instance.isUpdatingPlaylist) {
        return;
    }

    if (instance.lastPlayerData && !compareQueues(current, instance.playlist)) {
        return;
    }

    instance.isUpdatingPlaylist = true;

    const finish = (): void => {
        instance.isUpdatingPlaylist = false;
        instance.isPlaylistRendered = true;
    };

    updatePlaylist(instance, current).then(finish, finish);
}

function processUpdatedSessions(instance: SessionPlayer, sessions: SessionState[], apiClient: any): void {
    const serverId = apiClient.serverId();

    sessions.forEach(s => {
        if (s.NowPlayingItem) {
            s.NowPlayingItem.ServerId = serverId;
        }
    });

    const currentTargetId = getActivePlayerId();

    const session = sessions.filter(function (s) {
        return s.Id === currentTargetId;
    })[0];

    if (session) {
        normalizeImages(session, apiClient);

        updateCurrentQueue(instance, session);
        const eventNames = getChangedEvents(instance.lastPlayerData, session);

        instance.lastPlayerData = session;

        eventNames.forEach(eventName => {
            Events.trigger(instance, eventName, [session]);
        });
    } else {
        instance.lastPlayerData = session;

        playbackManager.setDefaultPlayerActive();
    }
}

function getBasicEvents(oldPlayerData: SessionState, newPlayerData: SessionState): string[] {
    const names: string[] = [];
    if (oldPlayerData.PlayState!.PositionTicks !== newPlayerData.PlayState!.PositionTicks) {
        names.push('timeupdate');
    }
    if (oldPlayerData.PlayState!.IsPaused !== newPlayerData.PlayState!.IsPaused) {
        names.push(newPlayerData.PlayState!.IsPaused ? 'pause' : 'unpause');
    }
    if (oldPlayerData.PlayState!.IsMuted !== newPlayerData.PlayState!.IsMuted
        || oldPlayerData.PlayState!.VolumeLevel !== newPlayerData.PlayState!.VolumeLevel) {
        names.push('volumechange');
    }
    if (oldPlayerData.PlayState!.RepeatMode !== newPlayerData.PlayState!.RepeatMode) {
        names.push('repeatmodechange');
    }
    return names;
}

function copyNewStateOfBasicEvents(oldPlayerData: SessionState, newPlayerData: SessionState): void {
    const prepareOldData = (oldObject: Record<string, unknown>, newObject: Record<string, unknown>, propertyName: string): void => {
        if (!Object.prototype.hasOwnProperty.call(newObject, propertyName)) {
            delete oldObject[propertyName];
        } else {
            oldObject[propertyName] = newObject[propertyName];
        }
    };

    prepareOldData(oldPlayerData.PlayState as Record<string, unknown>, newPlayerData.PlayState as Record<string, unknown>, 'PositionTicks');
    if (oldPlayerData.TranscodingInfo) {
        // TranscodingInfo.CompletionPercentage and TranscodingInfo.Framerate change with time
        // so it's enough if we only trigger 'timeupdate' event
        prepareOldData(oldPlayerData.TranscodingInfo as Record<string, unknown>, newPlayerData.TranscodingInfo as Record<string, unknown>, 'CompletionPercentage');
        prepareOldData(oldPlayerData.TranscodingInfo as Record<string, unknown>, newPlayerData.TranscodingInfo as Record<string, unknown>, 'Framerate');
    }
    prepareOldData(oldPlayerData as unknown as Record<string, unknown>, newPlayerData as unknown as Record<string, unknown>, 'LastActivityDate');
    prepareOldData(oldPlayerData as unknown as Record<string, unknown>, newPlayerData as unknown as Record<string, unknown>, 'LastPlaybackCheckIn');
    prepareOldData(oldPlayerData.PlayState as Record<string, unknown>, newPlayerData.PlayState as Record<string, unknown>, 'IsPaused');
    prepareOldData(oldPlayerData as unknown as Record<string, unknown>, newPlayerData as unknown as Record<string, unknown>, 'LastPausedDate');
    prepareOldData(oldPlayerData.PlayState as Record<string, unknown>, newPlayerData.PlayState as Record<string, unknown>, 'IsMuted');
    prepareOldData(oldPlayerData.PlayState as Record<string, unknown>, newPlayerData.PlayState as Record<string, unknown>, 'VolumeLevel');
    prepareOldData(oldPlayerData.PlayState as Record<string, unknown>, newPlayerData.PlayState as Record<string, unknown>, 'RepeatMode');
    prepareOldData(oldPlayerData.PlayState as Record<string, unknown>, newPlayerData.PlayState as Record<string, unknown>, 'OrderMode');
}

function getChangedEvents(oldPlayerData: SessionState | undefined, newPlayerData: SessionState): string[] {
    if (!oldPlayerData?.PlayState || !newPlayerData?.PlayState
        || (oldPlayerData.TranscodingInfo !== newPlayerData.TranscodingInfo && (!oldPlayerData.TranscodingInfo || !newPlayerData.TranscodingInfo))) {
        return ['statechange'];
    }

    const names = getBasicEvents(oldPlayerData, newPlayerData);
    // override the part of oldPlayerData, because it will be overwritten anyway, after this function
    copyNewStateOfBasicEvents(oldPlayerData, newPlayerData);

    if (!isEqual(oldPlayerData, newPlayerData)) {
        return ['statechange'];
    }

    return names;
}

function subscribeToPlayerUpdates(instance: SessionPlayer): void {
    instance.isUpdating = true;

    const apiClient = getCurrentApiClient(instance);
    instance._unsubscribeSessions = apiClient.subscribe(
        [OutboundWebSocketMessageType.Sessions],
        ({ Data }: { Data?: SessionState[] }) => processUpdatedSessions(instance, Data ?? [], apiClient),
        { [OutboundWebSocketMessageType.Sessions]: new PeriodicListenerInterval(100, 800) }
    );
}

function normalizeImages(state: SessionState, apiClient: any): void {
    if (state?.NowPlayingItem) {
        const item = state.NowPlayingItem as any;

        if (!item.ImageTags || (!item.ImageTags.Primary && item.PrimaryImageTag)) {
            item.ImageTags = (item.ImageTags || {}) as Record<string, string>;
            (item.ImageTags as Record<string, string>).Primary = item.PrimaryImageTag as string;
        }
        if (item.BackdropImageTag && item.BackdropItemId === item.Id) {
            item.BackdropImageTags = [item.BackdropImageTag];
        }
        if (item.BackdropImageTag && item.BackdropItemId !== item.Id) {
            item.ParentBackdropImageTags = [item.BackdropImageTag];
            item.ParentBackdropItemId = item.BackdropItemId;
        }
        if (!item.ServerId) {
            item.ServerId = apiClient.serverId();
        }
    }
}

class SessionPlayer {
    lastPlaylistItemId?: string;
    name: string;
    type: PluginType;
    isLocalPlayer: boolean;
    id: string;
    playlist: Array<{ Id: string; PlaylistItemId: string; [key: string]: unknown }> = [];
    isPlaylistRendered = true;
    isUpdatingPlaylist = false;
    isUpdating = false;
    lastPlayerData?: SessionState;
    playerListenerCount = 0;
    _unsubscribeSessions: (() => void) | null = null;
    currentServerId?: string;

    constructor() {
        this.name = 'Remote Control';
        this.type = PluginType.MediaPlayer;
        this.isLocalPlayer = false;
        this.id = 'remoteplayer';
    }

    beginPlayerUpdates(): void {
        this.playerListenerCount = this.playerListenerCount || 0;

        if (this.playerListenerCount <= 0) {
            this.playerListenerCount = 0;

            subscribeToPlayerUpdates(this);
        }

        this.playerListenerCount++;
    }

    endPlayerUpdates(): void {
        this.playerListenerCount = this.playerListenerCount || 0;
        this.playerListenerCount--;

        if (this.playerListenerCount <= 0) {
            unsubscribeFromPlayerUpdates(this);
            this.playerListenerCount = 0;
        }
    }

    getPlayerState(): SessionState {
        return this.lastPlayerData || {};
    }

    getTargets(): Promise<TargetInfo[]> {
        const apiClient = getCurrentApiClient(this);

        const sessionQuery: Record<string, unknown> = {
            ControllableByUserId: apiClient.getCurrentUserId()
        };

        if (apiClient) {
            const name = this.name;

            return apiClient.getSessions(sessionQuery).then(function (sessions: any[]) {
                return sessions.filter(function (s: any) {
                    return s.DeviceId !== apiClient.deviceId();
                }).map(function (s: any) {
                    return {
                        name: s.DeviceName,
                        deviceName: s.DeviceName,
                        deviceType: s.DeviceType,
                        id: s.Id,
                        playerName: name,
                        appName: s.Client,
                        playableMediaTypes: s.PlayableMediaTypes,
                        isLocalPlayer: false,
                        supportedCommands: s.Capabilities.SupportedCommands,
                        user: s.UserId ? {
                            Id: s.UserId,
                            Name: s.UserName,
                            PrimaryImageTag: s.UserPrimaryImageTag
                        } : null
                    };
                });
            });
        } else {
            return Promise.resolve([]);
        }
    }

    sendCommand(command: Record<string, unknown>): void {
        const sessionId = getActivePlayerId();

        const apiClient = getCurrentApiClient(this);
        apiClient.sendCommand(sessionId, command);
    }

    play(options: PlayOptions): Promise<void> {
        options = Object.assign({}, options);

        if (options.items) {
            options.ids = options.items.map(function (i) {
                return i.Id;
            });

            options.items = null!;
        }

        return sendPlayCommand(getCurrentApiClient(this), options, 'PlayNow');
    }

    shuffle(item: { Id: string; ServerId: string }): void {
        sendPlayCommand(getCurrentApiClient(this), { ids: [item.Id] }, 'PlayShuffle');
    }

    instantMix(item: { Id: string; ServerId: string }): void {
        sendPlayCommand(getCurrentApiClient(this), { ids: [item.Id] }, 'PlayInstantMix');
    }

    queue(options: PlayOptions): void {
        sendPlayCommand(getCurrentApiClient(this), options, 'PlayLast');
    }

    queueNext(options: PlayOptions): void {
        sendPlayCommand(getCurrentApiClient(this), options, 'PlayNext');
    }

    canPlayMediaType(mediaType: string): boolean {
        mediaType = (mediaType || '').toLowerCase();
        return mediaType === 'audio' || mediaType === 'video';
    }

    canQueueMediaType(mediaType: string): boolean {
        return this.canPlayMediaType(mediaType);
    }

    stop(): void {
        sendPlayStateCommand(getCurrentApiClient(this), 'stop');
    }

    nextTrack(): void {
        sendPlayStateCommand(getCurrentApiClient(this), 'nextTrack');
    }

    previousTrack(): void {
        sendPlayStateCommand(getCurrentApiClient(this), 'previousTrack');
    }

    seek(positionTicks: number): void {
        sendPlayStateCommand(getCurrentApiClient(this), 'seek',
            {
                SeekPositionTicks: positionTicks
            });
    }

    currentTime(val?: number): number | undefined {
        if (val != null) {
            this.seek(val * 10000);
            return;
        }

        let state: any = this.lastPlayerData || {};
        state = state.PlayState || {};
        return (state.PositionTicks as number) / 10000;
    }

    duration(): number | undefined {
        let state: any = this.lastPlayerData || {};
        state = state.NowPlayingItem || {};
        return state.RunTimeTicks as number;
    }

    paused(): boolean | undefined {
        let state: any = this.lastPlayerData || {};
        state = state.PlayState || {};
        return state.IsPaused as boolean;
    }

    getVolume(): number | undefined {
        let state: any = this.lastPlayerData || {};
        state = state.PlayState || {};
        return state.VolumeLevel as number;
    }

    isMuted(): boolean | undefined {
        let state: any = this.lastPlayerData || {};
        state = state.PlayState || {};
        return state.IsMuted as boolean;
    }

    pause(): void {
        sendPlayStateCommand(getCurrentApiClient(this), 'Pause');
    }

    unpause(): void {
        sendPlayStateCommand(getCurrentApiClient(this), 'Unpause');
    }

    playPause(): void {
        sendPlayStateCommand(getCurrentApiClient(this), 'PlayPause');
    }

    setMute(isMuted: boolean): void {
        if (isMuted) {
            sendCommandByName(this, 'Mute');
        } else {
            sendCommandByName(this, 'Unmute');
        }
    }

    toggleMute(): void {
        sendCommandByName(this, 'ToggleMute');
    }

    setVolume(vol: number): void {
        sendCommandByName(this, 'SetVolume', {
            Volume: vol
        });
    }

    volumeUp(): void {
        sendCommandByName(this, 'VolumeUp');
    }

    volumeDown(): void {
        sendCommandByName(this, 'VolumeDown');
    }

    toggleFullscreen(): void {
        sendCommandByName(this, 'ToggleFullscreen');
    }

    audioTracks(): unknown[] {
        let state: any = this.lastPlayerData || {};
        state = state.NowPlayingItem || {};
        const streams = (state.MediaStreams || []) as unknown[];
        return streams.filter(function (s: any) {
            return s.Type === 'Audio';
        });
    }

    getAudioStreamIndex(): number | undefined {
        let state: any = this.lastPlayerData || {};
        state = state.PlayState || {};
        return state.AudioStreamIndex as number;
    }

    playTrailers(item: { Id: string }): void {
        sendCommandByName(this, 'PlayTrailers', {
            ItemId: item.Id
        });
    }

    setAudioStreamIndex(index: number | null): void {
        sendCommandByName(this, 'SetAudioStreamIndex', {
            Index: index
        });
    }

    subtitleTracks(): unknown[] {
        let state: any = this.lastPlayerData || {};
        state = state.NowPlayingItem || {};
        const streams = (state.MediaStreams || []) as unknown[];
        return streams.filter(function (s: any) {
            return s.Type === 'Subtitle';
        });
    }

    getSubtitleStreamIndex(): number | undefined {
        let state: any = this.lastPlayerData || {};
        state = state.PlayState || {};
        return state.SubtitleStreamIndex as number;
    }

    setSubtitleStreamIndex(index: number | null): void {
        sendCommandByName(this, 'SetSubtitleStreamIndex', {
            Index: index
        });
    }

    setRepeatMode(mode: unknown): void {
        sendCommandByName(this, 'SetRepeatMode', {
            RepeatMode: mode
        });
    }

    getRepeatMode(): void {
        // not supported?
    }

    setQueueShuffleMode(mode: unknown): void {
        sendCommandByName(this, 'SetShuffleQueue', {
            ShuffleMode: mode
        });
    }

    getQueueShuffleMode(): void {
        // not supported?
    }

    displayContent(options: Record<string, unknown>): void {
        sendCommandByName(this, 'DisplayContent', options);
    }

    isPlaying(mediaType?: string): boolean {
        const state: any = this.lastPlayerData || {};
        return state.NowPlayingItem != null && (state.NowPlayingItem.MediaType === mediaType || !mediaType);
    }

    isPlayingVideo(): boolean {
        let state: any = this.lastPlayerData || {};
        state = state.NowPlayingItem || {};
        return state.MediaType === 'Video';
    }

    isPlayingAudio(): boolean {
        let state: any = this.lastPlayerData || {};
        state = state.NowPlayingItem || {};
        return state.MediaType === 'Audio';
    }

    getTrackIndex(playlistItemId: string): number | undefined {
        for (let i = 0; i < this.playlist.length; i++) {
            if (this.playlist[i].PlaylistItemId === playlistItemId) {
                return i;
            }
        }
    }

    getPlaylist(): Promise<Array<{ Id: string; PlaylistItemId: string; [key: string]: unknown }>> {
        let itemId: string | undefined;

        if (this.lastPlayerData) {
            itemId = this.lastPlayerData.PlaylistItemId;
        }

        if (this.playlist.length > 0 && (this.isPlaylistRendered || itemId !== this.lastPlaylistItemId)) {
            this.isPlaylistRendered = false;
            this.lastPlaylistItemId = itemId;
            return Promise.resolve(this.playlist);
        }
        return Promise.resolve([]);
    }

    movePlaylistItem(playlistItemId: string, newIndex: number): Promise<void> {
        const index = this.getTrackIndex(playlistItemId);
        if (index === newIndex) return Promise.resolve();

        const current = this.getCurrentPlaylistItemId();
        let currentIndex = 0;

        if (current === playlistItemId) {
            currentIndex = newIndex;
        }

        const append = (newIndex + 1 >= this.playlist.length);

        if (newIndex > index!) newIndex++;

        const ids: string[] = [];
        const item = this.playlist[index!];

        for (let i = 0; i < this.playlist.length; i++) {
            if (i === index) continue;

            if (i === newIndex) {
                ids.push(item.Id);
            }

            if (this.playlist[i].PlaylistItemId === current) {
                currentIndex = ids.length;
            }

            ids.push(this.playlist[i].Id);
        }

        if (append) {
            ids.push(item.Id);
        }

        const options: PlayOptions = {
            ids,
            startIndex: currentIndex
        };

        return sendPlayCommand(getCurrentApiClient(this), options, 'PlayNow');
    }

    getCurrentPlaylistItemId(): string | undefined {
        return this.lastPlayerData?.PlaylistItemId;
    }

    setCurrentPlaylistItem(playlistItemId: string): Promise<void> {
        const options: PlayOptions = {
            ids: this.playlist.map(i => i.Id),
            startIndex: this.getTrackIndex(playlistItemId)
        };
        return sendPlayCommand(getCurrentApiClient(this), options, 'PlayNow');
    }

    removeFromPlaylist(): Promise<void> {
        return Promise.resolve();
    }

    tryPair(): Promise<void> {
        return Promise.resolve();
    }
}

export default SessionPlayer;
