import appSettings from '../../scripts/settings/appSettings';
import * as userSettings from '../../scripts/settings/userSettings';
import { playbackManager } from '../../components/playback/playbackmanager';
import globalize from '../../lib/globalize';
import CastSenderApi from './castSenderApi';
import alert from '../../components/alert';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { PluginType } from '../../types/plugin.ts';
import Events from '../../utils/events.ts';
import { getItems } from '../../utils/jellyfin-apiclient/getItems.ts';

// Based on https://github.com/googlecast/CastVideos-chrome/blob/master/CastVideos.js

const PlayerName = 'Google Cast';

interface CastMessage {
    options: Record<string, unknown>;
    command: string;
    userId?: string;
    deviceId?: string;
    accessToken?: string;
    serverAddress?: string;
    serverId?: string;
    serverVersion?: string;
    receiverName?: string;
    maxBitrate?: number;
    subtitleAppearance?: unknown;
    subtitleBurnIn?: string;
}

interface PlayerStateData {
    NowPlayingItem?: Record<string, any>;
    PlayState?: Record<string, any>;
    ItemId?: string;
    nextItem?: unknown;
    NextMediaType?: unknown;
    [key: string]: any;
}

/*
 * Some async CastSDK function are completed with callbacks.
 * sendConnectionResult turns this into completion as a promise.
 */
let _currentResolve: (() => void) | null = null;
let _currentReject: (() => void) | null = null;
function sendConnectionResult(isOk: boolean): void {
    const resolve = _currentResolve;
    const reject = _currentReject;

    _currentResolve = null;
    _currentReject = null;

    if (isOk) {
        if (resolve) {
            resolve();
        }
    } else if (reject) {
        reject();
    } else {
        playbackManager.removeActivePlayer(PlayerName);
    }
}

/**
 * Constants of states for Chromecast device
 **/
const DEVICE_STATE: Record<string, number> = {
    'IDLE': 0,
    'ACTIVE': 1,
    'WARNING': 2,
    'ERROR': 3
};

/**
 * Constants of states for CastPlayer
 **/
const PLAYER_STATE: Record<string, string> = {
    'IDLE': 'IDLE',
    'LOADING': 'LOADING',
    'LOADED': 'LOADED',
    'PLAYING': 'PLAYING',
    'PAUSED': 'PAUSED',
    'STOPPED': 'STOPPED',
    'SEEKING': 'SEEKING',
    'ERROR': 'ERROR'
};

const messageNamespace = 'urn:x-cast:com.connectsdk';

class CastPlayer {
    deviceState: number;
    currentMediaSession: any;
    session: any;
    castPlayerState: string;
    hasReceivers: boolean;
    errorHandler: () => void;
    mediaStatusUpdateHandler: (e: boolean) => void;
    isInitialized = false;

    constructor() {
        this.deviceState = DEVICE_STATE.IDLE;
        this.currentMediaSession = null;
        this.session = null;
        this.castPlayerState = PLAYER_STATE.IDLE;
        this.hasReceivers = false;

        // bind once - commit 2ebffc2271da0bc5e8b13821586aee2a2e3c7753
        this.errorHandler = this.onError.bind(this);
        this.mediaStatusUpdateHandler = this.onMediaStatusUpdate.bind(this);

        this.initializeCastPlayer();
    }

    initializeCastPlayer(): void {
        const chrome = (window as unknown as Record<string, unknown>)['chrome'] as any;
        if (!chrome) {
            console.warn('Not initializing chromecast: chrome object is missing');
            return;
        }

        if (!chrome.cast?.isAvailable) {
            setTimeout(this.initializeCastPlayer.bind(this), 1000);
            return;
        }

        const apiClient = ServerConnections.currentApiClient() as any;
        if (!apiClient) {
            return;
        }
        const userId = apiClient.getCurrentUserId();

        apiClient.getUser(userId).then((user: any) => {
            const applicationID = user.Configuration.CastReceiverId;
            if (!applicationID) {
                console.warn(`Not initializing chromecast: CastReceiverId is ${applicationID}`);
                return;
            }

            // request session
            const sessionRequest = new chrome.cast.SessionRequest(applicationID);
            const apiConfig = new chrome.cast.ApiConfig(sessionRequest,
                this.sessionListener.bind(this),
                this.receiverListener.bind(this));

            console.debug(`chromecast.initialize (applicationId=${applicationID})`);
            chrome.cast.initialize(apiConfig, this.onInitSuccess.bind(this), this.errorHandler);
        });
    }

    onInitSuccess(): void {
        this.isInitialized = true;
        console.debug('[chromecastPlayer] init success');
    }

    onError(): void {
        console.debug('[chromecastPlayer] error');
    }

    sessionListener(e: any): void {
        this.session = e;
        if (this.session) {
            if (this.session.media[0]) {
                this.onMediaDiscovered('activeSession', this.session.media[0]);
            }

            this.onSessionConnected(e);
        }
    }

    messageListener(namespace: string, message: string | object): void {
        if (typeof (message) === 'string') {
            message = JSON.parse(message);
        }
        const msg = message as { type?: string; data?: unknown };

        if (msg.type === 'playbackerror') {
            const errorCode = msg.data;
            setTimeout(function () {
                alertText(globalize.translate('MessagePlaybackError' + errorCode), globalize.translate('HeaderPlaybackError'));
            }, 300);
        } else if (msg.type === 'connectionerror') {
            setTimeout(function () {
                alertText(globalize.translate('MessageChromecastConnectionError'), globalize.translate('HeaderError'));
            }, 300);
        } else if (msg.type) {
            Events.trigger(this, msg.type, [msg.data]);
        }
    }

    receiverListener(e: string): void {
        if (e === 'available') {
            console.debug('[chromecastPlayer] receiver found');
            this.hasReceivers = true;
        } else {
            console.debug('[chromecastPlayer] receiver list empty');
            this.hasReceivers = false;
        }
    }

    sessionUpdateListener(isAlive: boolean): void {
        if (isAlive) {
            console.debug('[chromecastPlayer] sessionUpdateListener: already alive');
        } else {
            this.session = null;
            this.deviceState = DEVICE_STATE.IDLE;
            this.castPlayerState = PLAYER_STATE.IDLE;
            document.removeEventListener('volumeupbutton', onVolumeUpKeyDown, false);
            document.removeEventListener('volumedownbutton', onVolumeDownKeyDown, false);

            console.debug('[chromecastPlayer] sessionUpdateListener: setting currentMediaSession to null');
            this.currentMediaSession = null;

            sendConnectionResult(false);
        }
    }

    launchApp(): void {
        console.debug('[chromecastPlayer] launching app...');
        (window as any).chrome.cast.requestSession(this.onRequestSessionSuccess.bind(this), this.onLaunchError.bind(this));
    }

    onRequestSessionSuccess(e: any): void {
        console.debug('[chromecastPlayer] session success: ' + e.sessionId);
        this.onSessionConnected(e);
    }

    onSessionConnected(session: any): void {
        this.session = session;
        this.deviceState = DEVICE_STATE.ACTIVE;

        this.session.addMessageListener(messageNamespace, this.messageListener.bind(this));
        this.session.addMediaListener(this.sessionMediaListener.bind(this));
        this.session.addUpdateListener(this.sessionUpdateListener.bind(this));

        document.addEventListener('volumeupbutton', onVolumeUpKeyDown, false);
        document.addEventListener('volumedownbutton', onVolumeDownKeyDown, false);

        Events.trigger(this, 'connect');
        this.sendMessage({
            options: {},
            command: 'Identify'
        });
    }

    sessionMediaListener(e: any): void {
        this.currentMediaSession = e;
        this.currentMediaSession.addUpdateListener(this.mediaStatusUpdateHandler);
    }

    onLaunchError(): void {
        console.debug('[chromecastPlayer] launch error');
        this.deviceState = DEVICE_STATE.ERROR;
        sendConnectionResult(false);
    }

    stopApp(): void {
        if (this.session) {
            this.session.stop(this.onStopAppSuccess.bind(this, 'Session stopped'), this.errorHandler);
        }
    }

    onStopAppSuccess(message: string): void {
        console.debug(message);

        this.deviceState = DEVICE_STATE.IDLE;
        this.castPlayerState = PLAYER_STATE.IDLE;
        document.removeEventListener('volumeupbutton', onVolumeUpKeyDown, false);
        document.removeEventListener('volumedownbutton', onVolumeDownKeyDown, false);

        this.currentMediaSession = null;
    }

    loadMedia(options: { items: any[]; [key: string]: unknown }, command: string): Promise<void> {
        if (!this.session) {
            console.debug('[chromecastPlayer] no session');
            return Promise.reject(new Error('no session'));
        }

        // convert items to smaller stubs to send minimal amount of information
        options.items = options.items.map(function (i: any) {
            return {
                Id: i.Id,
                ServerId: i.ServerId,
                Name: i.Name,
                Type: i.Type,
                MediaType: i.MediaType,
                IsFolder: i.IsFolder
            };
        });

        return this.sendMessage({
            options: options,
            command: command
        });
    }

    sendMessage(message: CastMessage): Promise<void> {
        let receiverName: string | null = null;

        const session = this.session;

        if (session?.receiver?.friendlyName) {
            receiverName = session.receiver.friendlyName;
        }

        let apiClient: any;
        if (message.options?.ServerId) {
            apiClient = ServerConnections.getApiClient(message.options.ServerId);
        } else if ((message.options?.items as any[])?.length) {
            apiClient = ServerConnections.getApiClient((message.options.items as any[])[0].ServerId);
        } else {
            apiClient = ServerConnections.currentApiClient();
        }

        /* If serverAddress is localhost,this address can not be used for the cast receiver device.
         * Use the local address (ULA, Unique Local Address) in that case.
         */
        const serverAddress = apiClient.serverAddress();
        const hostname = (new URL(serverAddress)).hostname;
        const isLocalhost = hostname === 'localhost' || hostname.startsWith('127.') || hostname === '[::1]';
        const serverLocalAddress = isLocalhost ? apiClient.serverInfo().LocalAddress : serverAddress;

        Object.assign(message, {
            userId: apiClient.getCurrentUserId(),
            deviceId: apiClient.deviceId(),
            accessToken: apiClient.accessToken(),
            serverAddress: serverLocalAddress,
            serverId: apiClient.serverId(),
            serverVersion: apiClient.serverVersion(),
            receiverName: receiverName
        });

        console.debug('[chromecastPlayer] message{' + message.command + '; ' + serverAddress + ' -> ' + serverLocalAddress + '}');

        const bitrateSetting = appSettings.maxChromecastBitrate();
        if (bitrateSetting) {
            message.maxBitrate = bitrateSetting;
        }

        if (message.options?.items) {
            message.subtitleAppearance = userSettings.getSubtitleAppearanceSettings();
            message.subtitleBurnIn = appSettings.get('subtitleburnin') || '';
        }

        return this.sendMessageInternal(message);
    }

    sendMessageInternal(message: CastMessage): Promise<void> {
        const serialized = JSON.stringify(message);

        this.session.sendMessage(messageNamespace, serialized, this.onPlayCommandSuccess.bind(this), this.errorHandler);
        return Promise.resolve();
    }

    onPlayCommandSuccess(): void {
        console.debug('Message was sent to receiver ok.');
    }

    onMediaDiscovered(how: string, media: any): void {
        console.debug('[chromecastPlayer] new media session ID:' + media.mediaSessionId + ' (' + how + ')');
        this.currentMediaSession = media;

        if (how === 'loadMedia') {
            this.castPlayerState = PLAYER_STATE.PLAYING;
        }

        if (how === 'activeSession') {
            this.castPlayerState = media.playerState;
        }

        this.currentMediaSession.addUpdateListener(this.mediaStatusUpdateHandler);
    }

    onMediaStatusUpdate(e: boolean): void {
        console.debug('[chromecastPlayer] updating media: ' + e);
        if (e === false) {
            this.castPlayerState = PLAYER_STATE.IDLE;
        }
    }

    setReceiverVolume(mute: boolean, vol?: number): void {
        if (!this.currentMediaSession) {
            console.debug('this.currentMediaSession is null');
            return;
        }

        if (!mute) {
            this.session.setReceiverVolumeLevel((vol || 1),
                this.mediaCommandSuccessCallback.bind(this),
                this.errorHandler);
        } else {
            this.session.setReceiverMuted(true,
                this.mediaCommandSuccessCallback.bind(this),
                this.errorHandler);
        }
    }

    mute(): void {
        this.setReceiverVolume(true);
    }

    mediaCommandSuccessCallback(info: any): void {
        console.debug(info);
    }
}

function alertText(text: string, title: string): void {
    alert({
        text,
        title
    });
}

function onVolumeUpKeyDown(): void {
    playbackManager.volumeUp();
}

function onVolumeDownKeyDown(): void {
    playbackManager.volumeDown();
}

function normalizeImages(state: PlayerStateData): void {
    if (state?.NowPlayingItem) {
        const item = state.NowPlayingItem;

        const imageTags = (item.ImageTags ??= {});
        if (!imageTags.Primary && item.PrimaryImageTag) {
            imageTags.Primary = item.PrimaryImageTag;
        }
        if (item.BackdropImageTag && item.BackdropItemId === item.Id) {
            item.BackdropImageTags = [item.BackdropImageTag];
        }
        if (item.BackdropImageTag && item.BackdropItemId !== item.Id) {
            item.ParentBackdropImageTags = [item.BackdropImageTag];
            item.ParentBackdropItemId = item.BackdropItemId;
        }
    }
}

function getItemsForPlayback(apiClient: any, query: { Ids?: string; Limit?: number; ExcludeLocationTypes?: string; EnableTotalRecordCount?: boolean }): Promise<{ Items: any[]; TotalRecordCount: number }> {
    const userId = apiClient.getCurrentUserId();

    if (query.Ids && query.Ids.split(',').length === 1) {
        return apiClient.getItem(userId, query.Ids.split(',')).then(function (item: any) {
            return {
                Items: [item],
                TotalRecordCount: 1
            };
        });
    } else {
        query.Limit = query.Limit || 100;
        query.ExcludeLocationTypes = 'Virtual';
        query.EnableTotalRecordCount = false;

        return getItems(apiClient, userId, query) as unknown as Promise<{ Items: any[]; TotalRecordCount: number }>;
    }
}

/*
 * relay castPlayer events to ChromecastPlayer events and include state info
 */
function bindEventForRelay(instance: ChromecastPlayer, eventName: string): void {
    Events.on(instance._castPlayer!, eventName, function (_e: unknown, data: PlayerStateData) {
        console.debug('[chromecastPlayer] ' + eventName);
        // skip events without data
        if (data?.ItemId) {
            const state = instance.getPlayerStateInternal(data);
            Events.trigger(instance, eventName, [state]);
        }
    });
}

function initializeChromecast(this: ChromecastPlayer): void {
    const instance = this;
    instance._castPlayer = new CastPlayer();

    // To allow the native android app to override
    document.dispatchEvent(new CustomEvent('chromecastloaded', {
        detail: {
            player: instance
        }
    }));

    Events.on(instance._castPlayer, 'connect', function () {
        if (_currentResolve) {
            sendConnectionResult(true);
        } else {
            playbackManager.setActivePlayer(PlayerName, instance.getCurrentTargetInfo());
        }

        console.debug('[chromecastPlayer] connect');
        // Reset this so that statechange will fire
        instance.lastPlayerData = null;
    });

    Events.on(instance._castPlayer, 'playbackstart', function (_e: unknown, data: PlayerStateData) {
        console.debug('[chromecastPlayer] playbackstart');

        instance._castPlayer!.initializeCastPlayer();

        const state = instance.getPlayerStateInternal(data);
        Events.trigger(instance, 'playbackstart', [state]);

        // be prepared that after this media item a next one may follow. See playbackManager
        instance._playNextAfterEnded = true;
    });

    Events.on(instance._castPlayer, 'playbackstop', function (_e: unknown, data: PlayerStateData) {
        console.debug('[chromecastPlayer] playbackstop');

        let state = instance.getPlayerStateInternal(data);

        if (!instance._playNextAfterEnded) {
            // mark that no next media items are to be processed.
            state.nextItem = null;
            state.NextMediaType = null;
        }
        Events.trigger(instance, 'playbackstop', [state]);

        state = (instance.lastPlayerData as PlayerStateData)?.PlayState || {};
        const volume = (state as any).VolumeLevel || 0.5;
        const mute = (state as any).IsMuted || false;

        // Reset this so the next query doesn't make it appear like content is playing.
        instance.lastPlayerData = {
            PlayState: {
                VolumeLevel: volume,
                IsMuted: mute
            }
        };
    });

    Events.on(instance._castPlayer, 'playbackprogress', function (_e: unknown, data: PlayerStateData) {
        console.debug('[chromecastPlayer] positionchange');
        const state = instance.getPlayerStateInternal(data);

        Events.trigger(instance, 'timeupdate', [state]);
    });

    bindEventForRelay(instance, 'timeupdate');
    bindEventForRelay(instance, 'pause');
    bindEventForRelay(instance, 'unpause');
    bindEventForRelay(instance, 'volumechange');
    bindEventForRelay(instance, 'repeatmodechange');
    bindEventForRelay(instance, 'shufflequeuemodechange');

    Events.on(instance._castPlayer, 'playstatechange', function (_e: unknown, data: PlayerStateData) {
        console.debug('[chromecastPlayer] playstatechange');

        // Updates the player and nowPlayingBar state to the current 'pause' state.
        const state = instance.getPlayerStateInternal(data);
        Events.trigger(instance, 'pause', [state]);
    });
}

class ChromecastPlayer {
    name: string;
    type: PluginType;
    id: string;
    isLocalPlayer: boolean;
    lastPlayerData: PlayerStateData | null;
    _castPlayer: CastPlayer | null = null;
    _playNextAfterEnded = false;

    constructor() {
        // playbackManager needs this
        this.name = PlayerName;
        this.type = PluginType.MediaPlayer;
        this.id = 'chromecast';
        this.isLocalPlayer = false;
        this.lastPlayerData = {};

        new CastSenderApi().load().then(() => {
            Events.on(ServerConnections, 'localusersignedin', () => {
                initializeChromecast.call(this);
            });

            if ((ServerConnections.currentApiClient() as any)?.getCurrentUserId()) {
                initializeChromecast.call(this);
            }
        });
    }

    tryPair(): Promise<void> {
        const castPlayer = this._castPlayer!;

        if (castPlayer.deviceState !== DEVICE_STATE.ACTIVE && castPlayer.isInitialized) {
            return new Promise<void>(function (resolve, reject) {
                _currentResolve = resolve;
                _currentReject = reject;
                castPlayer.launchApp();
            });
        } else {
            _currentResolve = null;
            _currentReject = null;
            return Promise.reject(new Error('tryPair failed'));
        }
    }

    getTargets(): Promise<Array<Record<string, unknown>>> {
        const targets: Array<Record<string, unknown>> = [];

        if (this._castPlayer?.hasReceivers) {
            targets.push(this.getCurrentTargetInfo());
        }

        return Promise.resolve(targets);
    }

    getCurrentTargetInfo(): Record<string, unknown> {
        let appName: string | null = null;

        const castPlayer = this._castPlayer;

        if (castPlayer?.session?.receiver?.friendlyName) {
            appName = castPlayer.session.receiver.friendlyName;
        }

        return {
            name: PlayerName,
            id: PlayerName,
            playerName: PlayerName,
            playableMediaTypes: ['Audio', 'Video'],
            isLocalPlayer: false,
            appName: PlayerName,
            deviceName: appName,
            deviceType: 'cast',
            supportedCommands: [
                'VolumeUp',
                'VolumeDown',
                'Mute',
                'Unmute',
                'ToggleMute',
                'SetVolume',
                'SetAudioStreamIndex',
                'SetSubtitleStreamIndex',
                'DisplayContent',
                'SetRepeatMode'
            ]
        };
    }

    getPlayerStateInternal(data?: PlayerStateData | null): PlayerStateData {
        let triggerStateChange = false;
        if (data && !this.lastPlayerData) {
            triggerStateChange = true;
        }

        data = data || this.lastPlayerData!;
        this.lastPlayerData = data;

        normalizeImages(data);

        if (triggerStateChange) {
            Events.trigger(this, 'statechange', [data]);
        }

        return data;
    }

    playWithCommand(options: { items?: any[]; serverId?: string; ids?: string[] }, command: string): Promise<void> {
        if (!options.items) {
        const apiClient = ServerConnections.getApiClient(options.serverId!) as any;

        return apiClient.getItem(apiClient.getCurrentUserId(), options.ids![0]).then((item: any) => {
                options.items = [item];
                return this.playWithCommand(options, command);
            });
        }

        if (options.items!.length > 1 && options?.ids) {
            // Use the original request id array for sorting the result in the proper order
            options.items!.sort(function (a: any, b: any) {
                return options.ids!.indexOf(a.Id) - options.ids!.indexOf(b.Id);
            });
        }

        return this._castPlayer!.loadMedia(options as any, command);
    }

    seek(position: number): void {
        position = parseInt(position as any, 10);

        position = position / 10000000;

        this._castPlayer!.sendMessage({
            options: {
                position: position
            },
            command: 'Seek'
        });
    }

    setAudioStreamIndex(index: number): void {
        this._castPlayer!.sendMessage({
            options: {
                index: index
            },
            command: 'SetAudioStreamIndex'
        });
    }

    setSubtitleStreamIndex(index: number): void {
        this._castPlayer!.sendMessage({
            options: {
                index: index
            },
            command: 'SetSubtitleStreamIndex'
        });
    }

    setMaxStreamingBitrate(options: Record<string, unknown>): void {
        this._castPlayer!.sendMessage({
            options: options,
            command: 'SetMaxStreamingBitrate'
        });
    }

    isFullscreen(): boolean | undefined {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};
        return state.IsFullscreen as boolean;
    }

    nextTrack(): void {
        this._castPlayer!.sendMessage({
            options: {},
            command: 'NextTrack'
        });
    }

    previousTrack(): void {
        this._castPlayer!.sendMessage({
            options: {},
            command: 'PreviousTrack'
        });
    }

    volumeDown(): void {
        let vol = this._castPlayer!.session.receiver.volume.level;
        if (vol == null) {
            vol = 0.5;
        }
        vol -= 0.05;
        vol = Math.max(vol, 0);

        this._castPlayer!.session.setReceiverVolumeLevel(vol);
    }

    endSession(): void {
        const instance = this;

        this.stop().then(function () {
            setTimeout(function () {
                instance._castPlayer!.stopApp();
            }, 1000);
        });
    }

    volumeUp(): void {
        let vol = this._castPlayer!.session.receiver.volume.level;
        if (vol == null) {
            vol = 0.5;
        }
        vol += 0.05;
        vol = Math.min(vol, 1);

        this._castPlayer!.session.setReceiverVolumeLevel(vol);
    }

    setVolume(vol: number): void {
        vol = Math.min(vol, 100);
        vol = Math.max(vol, 0);
        vol = vol / 100;

        this._castPlayer!.session.setReceiverVolumeLevel(vol);
    }

    unpause(): void {
        this._castPlayer!.sendMessage({
            options: {},
            command: 'Unpause'
        });
    }

    playPause(): void {
        this._castPlayer!.sendMessage({
            options: {},
            command: 'PlayPause'
        });
    }

    pause(): void {
        this._castPlayer!.sendMessage({
            options: {},
            command: 'Pause'
        });
    }

    stop(): Promise<void> {
        // suppress playing a next media item after this one. See playbackManager
        this._playNextAfterEnded = false;
        return this._castPlayer!.sendMessage({
            options: {},
            command: 'Stop'
        });
    }

    displayContent(options: Record<string, unknown>): void {
        this._castPlayer!.sendMessage({
            options: options,
            command: 'DisplayContent'
        });
    }

    setMute(isMuted: boolean): void {
        const castPlayer = this._castPlayer!;

        if (isMuted) {
            castPlayer.sendMessage({
                options: {},
                command: 'Mute'
            });
        } else {
            castPlayer.sendMessage({
                options: {},
                command: 'Unmute'
            });
        }
    }

    getRepeatMode(): unknown {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};
        return state.RepeatMode;
    }

    getQueueShuffleMode(): unknown {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};
        return state.ShuffleMode;
    }

    playTrailers(): void {
        console.warn('[chromecastPlayer] Playing trailers is not supported.');
    }

    setRepeatMode(mode: unknown): void {
        this._castPlayer!.sendMessage({
            options: {
                RepeatMode: mode
            },
            command: 'SetRepeatMode'
        });
    }

    setQueueShuffleMode(): void {
        console.warn('[chromecastPlayer] Setting shuffle queue mode is not supported.');
    }

    toggleMute(): void {
        this._castPlayer!.sendMessage({
            options: {},
            command: 'ToggleMute'
        });
    }

    audioTracks(): unknown[] {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.NowPlayingItem as Record<string, unknown>) || {};
        const streams = (state.MediaStreams || []) as unknown[];
        return streams.filter(function (s: any) {
            return s.Type === 'Audio';
        });
    }

    getAudioStreamIndex(): unknown {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};
        return state.AudioStreamIndex;
    }

    subtitleTracks(): unknown[] {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.NowPlayingItem as Record<string, unknown>) || {};
        const streams = (state.MediaStreams || []) as unknown[];
        return streams.filter(function (s: any) {
            return s.Type === 'Subtitle';
        });
    }

    getSubtitleStreamIndex(): unknown {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};
        return state.SubtitleStreamIndex;
    }

    getMaxStreamingBitrate(): unknown {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};
        return state.MaxStreamingBitrate;
    }

    getVolume(): number | unknown {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};

        return state.VolumeLevel == null ? 100 : state.VolumeLevel;
    }

    isPlaying(mediaType?: string): boolean {
        const state = this.lastPlayerData || {};
        return state.NowPlayingItem != null && ((state.NowPlayingItem as Record<string, unknown>).MediaType === mediaType || !mediaType);
    }

    isPlayingVideo(): boolean {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.NowPlayingItem as Record<string, unknown>) || {};
        return state.MediaType === 'Video';
    }

    isPlayingAudio(): boolean {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.NowPlayingItem as Record<string, unknown>) || {};
        return state.MediaType === 'Audio';
    }

    currentTime(val?: number): number | undefined {
        if (val != null) {
            this.seek(val * 10000);
            return;
        }

        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};
        return (state.PositionTicks as number) / 10000;
    }

    duration(): unknown {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.NowPlayingItem as Record<string, unknown>) || {};
        return state.RunTimeTicks;
    }

    getBufferedRanges(): unknown[] {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};
        return (state.BufferedRanges as unknown[]) || [];
    }

    paused(): boolean | undefined {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};

        return state.IsPaused as boolean;
    }

    isMuted(): boolean | undefined {
        let state: Record<string, unknown> = this.lastPlayerData || {};
        state = (state.PlayState as Record<string, unknown>) || {};

        return state.IsMuted as boolean;
    }

    shuffle(item: { ServerId: string; Id: string }): void {
        const apiClient = ServerConnections.getApiClient(item.ServerId) as any;
        const userId = apiClient.getCurrentUserId();

        apiClient.getItem(userId, item.Id).then((fetchedItem: any) => {
            this.playWithCommand({
                items: [fetchedItem]
            }, 'Shuffle');
        });
    }

    instantMix(item: { ServerId: string; Id: string }): void {
        const apiClient = ServerConnections.getApiClient(item.ServerId) as any;
        const userId = apiClient.getCurrentUserId();

        apiClient.getItem(userId, item.Id).then((fetchedItem: any) => {
            this.playWithCommand({
                items: [fetchedItem]
            }, 'InstantMix');
        });
    }

    canPlayMediaType(mediaType: string): boolean {
        mediaType = (mediaType || '').toLowerCase();
        return mediaType === 'audio' || mediaType === 'video';
    }

    canQueueMediaType(mediaType: string): boolean {
        return this.canPlayMediaType(mediaType);
    }

    queue(options: { items?: any[]; serverId?: string; ids?: string[] }): void {
        this.playWithCommand(options, 'PlayLast');
    }

    queueNext(options: { items?: any[]; serverId?: string; ids?: string[] }): void {
        this.playWithCommand(options, 'PlayNext');
    }

    play(options: { items?: any[]; serverId?: string; ids?: string[] }): Promise<void> {
        if (options.items) {
            return this.playWithCommand(options, 'PlayNow');
        } else {
            if (!options.serverId) {
                throw new Error('serverId required!');
            }

            const apiClient = ServerConnections.getApiClient(options.serverId);

            return getItemsForPlayback(apiClient, {
                Ids: options.ids!.join(',')
            }).then((result) => {
                options.items = result.Items;
                return this.playWithCommand(options, 'PlayNow');
            });
        }
    }

    toggleFullscreen(): void {
        // not supported
    }

    beginPlayerUpdates(): void {
        // Setup polling here
    }

    endPlayerUpdates(): void {
        // Stop polling here
    }

    getPlaylist(): Promise<unknown[]> {
        return Promise.resolve([]);
    }

    getCurrentPlaylistItemId(): void {
        // not supported?
    }

    setCurrentPlaylistItem(): Promise<void> {
        return Promise.resolve();
    }

    removeFromPlaylist(): Promise<void> {
        return Promise.resolve();
    }

    getPlayerState(): PlayerStateData {
        return this.getPlayerStateInternal() || {};
    }

    getCurrentPlaylistIndex(): unknown {
        // tbd: update to support playlists and not only album with tracks
        return this.getPlayerStateInternal()?.NowPlayingItem?.IndexNumber;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    clearQueue(currentTime?: number): void {
        // not supported yet
    }
}

export default ChromecastPlayer;
