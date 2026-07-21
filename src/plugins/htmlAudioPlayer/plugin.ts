import { AppFeature } from 'constants/appFeature';
import { MediaError } from 'types/mediaError';

import browser from '../../scripts/browser';
import { appHost } from '../../components/apphost';
import * as htmlMediaHelper from '../../components/htmlMediaHelper';
import profileBuilder from '../../scripts/browserDeviceProfile';
import { getIncludeCorsCredentials } from '../../scripts/settings/webSettings';
import { PluginType } from '../../types/plugin.ts';
import Events from '../../utils/events.ts';

interface PlayOptions {
    url: string;
    item: Record<string, unknown>;
    mediaSource: {
        RunTimeTicks?: number;
        Container?: string;
        MediaStreams?: Array<Record<string, unknown>>;
        DefaultSubtitleStreamIndex?: number;
        DefaultAudioStreamIndex?: number;
        DefaultSecondarySubtitleStreamIndex?: number;
        NormalizationGain?: number;
        albumNormalizationGain?: number;
    };
    playerStartPositionTicks?: number;
    playMethod?: string;
    transcodingOffsetTicks?: number;
    fullscreen?: boolean;
    backdropUrl?: string;
}

function getDefaultProfile() {
    return profileBuilder({});
}

let fadeTimeout: ReturnType<typeof setTimeout> | null;
function fade(instance: HtmlAudioPlayer, elem: HTMLAudioElement, startingVolume: number): Promise<void> {
    instance._isFadingOut = true;

    // Need to record the starting volume on each pass rather than querying elem.volume
    // This is due to iOS safari not allowing volume changes and always returning the system volume value
    const newVolume = Math.max(0, startingVolume - 0.15);
    console.debug('fading volume to ' + newVolume);
    elem.volume = newVolume;

    if (newVolume <= 0) {
        instance._isFadingOut = false;
        return Promise.resolve();
    }

    return new Promise<void>(function (resolve, reject) {
        cancelFadeTimeout();
        fadeTimeout = setTimeout(function () {
            fade(instance, elem, newVolume).then(resolve, reject);
        }, 100);
    });
}

function cancelFadeTimeout(): void {
    const timeout = fadeTimeout;
    if (timeout) {
        clearTimeout(timeout);
        fadeTimeout = null;
    }
}

function supportsFade(): boolean {
    // Not working on tizen.
    // We could possibly enable on other tv's, but all smart tv browsers tend to be pretty primitive
    return !browser.tv;
}

function requireHlsPlayer(callback: () => void): void {
    import('hls.js/dist/hls.js').then(({ default: hls }) => {
        hls.DefaultConfig.lowLatencyMode = false;
        hls.DefaultConfig.backBufferLength = Infinity;
        hls.DefaultConfig.liveBackBufferLength = 90;
        (window as any)['Hls'] = hls;
        callback();
    });
}

function enableHlsPlayer(url: string, item: Record<string, unknown>, mediaSource: PlayOptions['mediaSource'], mediaType: string): Promise<void> {
    if (!htmlMediaHelper.enableHlsJsPlayer(mediaSource.RunTimeTicks, mediaType)) {
        return Promise.reject();
    }

    if (url.indexOf('.m3u8') !== -1) {
        return Promise.resolve();
    }

    // issue head request to get content type
    return new Promise<void>(function (resolve, reject) {
        import('../../utils/fetch').then((fetchHelper) => {
            fetchHelper.ajax({
                url: url,
                type: 'HEAD'
            }).then(function (response: any) {
                const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
                if (contentType === 'application/vnd.apple.mpegurl' || contentType === 'application/x-mpegurl') {
                    resolve();
                } else {
                    reject();
                }
            }, reject);
        });
    });
}

class HtmlAudioPlayer {
    name: string;
    type: PluginType;
    id: string;
    priority: number;

    _started = false;
    _timeUpdated = false;
    _currentTime: number | null = null;
    _mediaElement: HTMLAudioElement | null = null;
    _currentSrc: string | undefined;
    _currentPlayOptions: PlayOptions | undefined;
    _hlsPlayer: unknown;
    _isFadingOut = false;
    gainNode: GainNode | undefined;
    normalizationGain = 1;

    constructor() {
        this.name = 'Html Audio Player';
        this.type = PluginType.MediaPlayer;
        this.id = 'htmlaudioplayer';

        // Let any players created by plugins take priority
        this.priority = 1;

        const self = this;

        self.play = function (options: PlayOptions): Promise<void> {
            self._started = false;
            self._timeUpdated = false;
            self._currentTime = null;

            const elem = createMediaElement(self);

            return setCurrentSrc(self, elem, options);
        };

        self.stop = function (destroyPlayer?: boolean): Promise<void> {
            cancelFadeTimeout();

            const elem = self._mediaElement;
            const src = self._currentSrc;

            if (elem && src) {
                if (!destroyPlayer || !supportsFade()) {
                    elem.pause();

                    htmlMediaHelper.onEndedInternal(self as any, elem, onError);

                    if (destroyPlayer) {
                        self.destroy();
                    }
                    return Promise.resolve();
                }

                const originalVolume = elem.volume;

                return fade(self, elem, elem.volume).then(function () {
                    elem.pause();
                    elem.volume = originalVolume;

                    htmlMediaHelper.onEndedInternal(self as any, elem, onError);

                    if (destroyPlayer) {
                        self.destroy();
                    }
                });
            }
            return Promise.resolve();
        };

        self.destroy = function (): void {
            if (self._mediaElement) {
                unBindEvents(self._mediaElement);
                htmlMediaHelper.resetSrc(self._mediaElement);
            }
        };

        function setCurrentSrc(self: HtmlAudioPlayer, elem: HTMLAudioElement, options: PlayOptions): Promise<void> {
            unBindEvents(elem);
            bindEvents(elem);

            let val = options.url;
            console.debug('playing url: ' + val);
            import('../../scripts/settings/userSettings').then((userSettings) => {
                let normalizationGain: number | undefined;
                if (userSettings.selectAudioNormalization() == 'TrackGain') {
                    normalizationGain = (options.item.NormalizationGain as number | undefined)
                        ?? options.mediaSource.albumNormalizationGain;
                } else if (userSettings.selectAudioNormalization() == 'AlbumGain') {
                    normalizationGain =
                        options.mediaSource.albumNormalizationGain
                        ?? (options.item.NormalizationGain as number | undefined);
                } else {
                    console.debug('normalization disabled');
                    return;
                }

                if (!self.gainNode) {
                    addGainElement(elem, self);
                    if (!self.gainNode) return;
                }

                if (normalizationGain) {
                    self.normalizationGain = Math.pow(10, normalizationGain / 20);
                    self.gainNode.gain.value = self.normalizationGain;
                } else {
                    self.gainNode.gain.value = 1;
                    self.normalizationGain = 1;
                }
                if (browser.safari) {
                    // Gain value is absolute in Safari. Add volume from the slider
                    self.gainNode.gain.value *= elem.volume;
                }
                console.debug('gain: ' + self.normalizationGain);
            }).catch((err: unknown) => {
                console.error('Failed to add/change gainNode', err);
            });

            // Convert to seconds
            const seconds = (options.playerStartPositionTicks || 0) / 10000000;
            if (seconds) {
                val += '#t=' + seconds;
            }

            htmlMediaHelper.destroyHlsPlayer(self as any);

            self._currentPlayOptions = options;

            const crossOrigin = htmlMediaHelper.getCrossOriginValue(options.mediaSource);
            if (crossOrigin) {
                elem.crossOrigin = crossOrigin;
            }

            return enableHlsPlayer(val, options.item, options.mediaSource, 'Audio').then(function () {
                return new Promise<void>(function (resolve, reject) {
                    requireHlsPlayer(async () => {
                        const includeCorsCredentials = await getIncludeCorsCredentials();

                        const HlsCtor = (window as any).Hls as new (options: any) => any;
                        const hls = new HlsCtor({
                            manifestLoadingTimeOut: 20000,
                            xhrSetup: function (xhr: XMLHttpRequest) {
                                xhr.withCredentials = includeCorsCredentials;
                            }
                        });
                        hls.loadSource(val);
                        hls.attachMedia(elem);

                        htmlMediaHelper.bindEventsToHlsPlayer(self as any, hls, elem, onError, resolve, reject);

                        self._hlsPlayer = hls;

                        self._currentSrc = val;
                    });
                });
            }, async () => {
                elem.autoplay = true;

                const includeCorsCredentials = await getIncludeCorsCredentials();
                if (includeCorsCredentials) {
                    // Safari will not send cookies without this
                    elem.crossOrigin = 'use-credentials';
                }

                return htmlMediaHelper.applySrc(elem, val, options).then(function () {
                    self._currentSrc = val;

                    return htmlMediaHelper.playWithPromise(elem, onError);
                });
            });
        }

        function bindEvents(elem: HTMLAudioElement): void {
            elem.addEventListener('timeupdate', onTimeUpdate);
            elem.addEventListener('ended', onEnded);
            elem.addEventListener('volumechange', onVolumeChange);
            elem.addEventListener('pause', onPause);
            elem.addEventListener('playing', onPlaying);
            elem.addEventListener('play', onPlay);
            elem.addEventListener('waiting', onWaiting);
        }

        function unBindEvents(elem: HTMLAudioElement): void {
            elem.removeEventListener('timeupdate', onTimeUpdate);
            elem.removeEventListener('ended', onEnded);
            elem.removeEventListener('volumechange', onVolumeChange);
            elem.removeEventListener('pause', onPause);
            elem.removeEventListener('playing', onPlaying);
            elem.removeEventListener('play', onPlay);
            elem.removeEventListener('waiting', onWaiting);
            elem.removeEventListener('error', onError); // bound in htmlMediaHelper
        }

        function createMediaElement(self: HtmlAudioPlayer): HTMLAudioElement {
            let elem = self._mediaElement;

            if (elem) {
                return elem;
            }

            elem = document.querySelector('.mediaPlayerAudio') as HTMLAudioElement | null;

            if (!elem) {
                elem = document.createElement('audio');
                elem.classList.add('mediaPlayerAudio');
                elem.classList.add('hide');

                document.body.appendChild(elem);
            }

            // TODO: Move volume control to PlaybackManager. Player should just be a wrapper that translates commands into API calls.
            if (!appHost.supports(AppFeature.PhysicalVolumeControl)) {
                elem.volume = htmlMediaHelper.getSavedVolume();
            }

            self._mediaElement = elem;

            return elem;
        }

        function onEnded(this: HTMLAudioElement): void {
            htmlMediaHelper.onEndedInternal(self as any, this, onError);
        }

        function onTimeUpdate(this: HTMLAudioElement): void {
            // Get the player position + the transcoding offset
            const time = this.currentTime;

            // Don't trigger events after user stop
            if (!self._isFadingOut) {
                self._currentTime = time;
                Events.trigger(self, 'timeupdate');
            }
        }

        function onVolumeChange(this: HTMLAudioElement): void {
            if (!self._isFadingOut) {
                htmlMediaHelper.saveVolume(this.volume);
                if (browser.safari && self.gainNode) {
                    self.gainNode.gain.value = this.volume * self.normalizationGain;
                }
                Events.trigger(self, 'volumechange');
            }
        }

        function onPlaying(this: HTMLAudioElement, e: Event): void {
            if (!self._started) {
                self._started = true;
                this.removeAttribute('controls');

                htmlMediaHelper.seekOnPlaybackStart(self as any, e.target as HTMLMediaElement, self._currentPlayOptions!.playerStartPositionTicks);
            }
            Events.trigger(self, 'playing');
        }

        function onPlay(): void {
            Events.trigger(self, 'unpause');
        }

        function onPause(): void {
            Events.trigger(self, 'pause');
        }

        function onWaiting(): void {
            Events.trigger(self, 'waiting');
        }

        function onError(this: HTMLMediaElement): void {
            const errorCode = this.error ? (this.error.code || 0) : 0;
            const errorMessage = this.error ? (this.error.message || '') : '';
            console.error('media element error: ' + errorCode.toString() + ' ' + errorMessage);

            let type: string;

            switch (errorCode) {
                case 1:
                    // MEDIA_ERR_ABORTED
                    // This will trigger when changing media while something is playing
                    return;
                case 2:
                    // MEDIA_ERR_NETWORK
                    type = MediaError.NETWORK_ERROR;
                    break;
                case 3:
                    // MEDIA_ERR_DECODE
                    if (self._hlsPlayer) {
                        htmlMediaHelper.handleHlsJsMediaError(self as any);
                        return;
                    } else {
                        type = MediaError.MEDIA_DECODE_ERROR;
                    }
                    break;
                case 4:
                    // MEDIA_ERR_SRC_NOT_SUPPORTED
                    type = MediaError.MEDIA_NOT_SUPPORTED;
                    break;
                default:
                    // seeing cases where Edge is firing error events with no error code
                    // example is start playing something, then immediately change src to something else
                    return;
            }

            htmlMediaHelper.onErrorInternal(self as any, type as any);
        }
    }

    play(options: PlayOptions): Promise<void> {
        // Assigned in constructor
        return (this as any).play(options);
    }

    stop(destroyPlayer?: boolean): Promise<void> {
        // Assigned in constructor
        return (this as any).stop(destroyPlayer);
    }

    destroy(): void {
        // Assigned in constructor
        (this as any).destroy();
    }

    currentSrc(): string | undefined {
        return this._currentSrc;
    }

    canPlayMediaType(mediaType: string): boolean {
        return (mediaType || '').toLowerCase() === 'audio';
    }

    getDeviceProfile(item: Record<string, unknown>): object {
        if (appHost.getDeviceProfile) {
            return appHost.getDeviceProfile(item);
        }

        return getDefaultProfile();
    }

    toggleAirPlay(): void {
        this.setAirPlayEnabled(!this.isAirPlayEnabled());
    }

    // Save this for when playback stops, because querying the time at that point might return 0
    currentTime(val?: number): number | undefined {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            if (val != null) {
                mediaElement.currentTime = val / 1000;
                return;
            }

            const currentTime = this._currentTime;
            if (currentTime) {
                return currentTime * 1000;
            }

            return (mediaElement.currentTime || 0) * 1000;
        }
    }

    duration(): number | null {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            const duration = mediaElement.duration;
            if (htmlMediaHelper.isValidDuration(duration)) {
                return duration * 1000;
            }
        }

        return null;
    }

    seekable(): boolean | undefined {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            const seekable = mediaElement.seekable;
            if (seekable?.length) {
                let start = seekable.start(0);
                let end = seekable.end(0);

                if (!htmlMediaHelper.isValidDuration(start)) {
                    start = 0;
                }
                if (!htmlMediaHelper.isValidDuration(end)) {
                    end = 0;
                }

                return (end - start) > 0;
            }

            return false;
        }
    }

    getBufferedRanges(): unknown[] {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            return htmlMediaHelper.getBufferedRanges(this as any, mediaElement);
        }

        return [];
    }

    pause(): void {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            mediaElement.pause();
        }
    }

    // This is a retry after error
    resume(): void {
        this.unpause();
    }

    unpause(): void {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            mediaElement.play();
        }
    }

    paused(): boolean {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            return mediaElement.paused;
        }

        return false;
    }

    setPlaybackRate(value: number): void {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            mediaElement.playbackRate = value;
        }
    }

    getPlaybackRate(): number | null {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            return mediaElement.playbackRate;
        }
        return null;
    }

    setVolume(val: number): void {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            mediaElement.volume = Math.pow(val / 100, 3);
        }
    }

    getVolume(): number | undefined {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            return Math.min(Math.round(Math.pow(mediaElement.volume, 1 / 3) * 100), 100);
        }
    }

    volumeUp(): void {
        this.setVolume(Math.min(this.getVolume()! + 2, 100));
    }

    volumeDown(): void {
        this.setVolume(Math.max(this.getVolume()! - 2, 0));
    }

    setMute(mute: boolean): void {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            mediaElement.muted = mute;
        }
    }

    isMuted(): boolean {
        const mediaElement = this._mediaElement;
        if (mediaElement) {
            return mediaElement.muted;
        }
        return false;
    }

    isAirPlayEnabled(): boolean {
        const doc = document as any;
        if (doc.AirPlayEnabled) {
            return !!doc.AirplayElement;
        }
        return false;
    }

    setAirPlayEnabled(isEnabled: boolean): void {
        const mediaElement = this._mediaElement;

        if (mediaElement) {
            const doc = document as any;
            if (doc.AirPlayEnabled) {
                if (isEnabled) {
                    (mediaElement as any).requestAirPlay().catch(function (err: unknown) {
                        console.error('Error requesting AirPlay', err);
                    });
                } else {
                    doc.exitAirPLay().catch(function (err: unknown) {
                        console.error('Error exiting AirPlay', err);
                    });
                }
            } else {
                (mediaElement as any).webkitShowPlaybackTargetPicker();
            }
        }
    }

    supports(feature: string): boolean {
        if (!supportedFeatures) {
            supportedFeatures = getSupportedFeatures();
        }

        return supportedFeatures.indexOf(feature) !== -1;
    }
}

let supportedFeatures: string[];

function getSupportedFeatures(): string[] {
    const list: string[] = [];
    const audio = document.createElement('audio');

    if (typeof audio.playbackRate === 'number') {
        list.push('PlaybackRate');
    }

    if (browser.safari) {
        list.push('AirPlay');
    }

    return list;
}

function addGainElement(elem: HTMLAudioElement, self: HtmlAudioPlayer): void {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

        const audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaElementSource(elem);

        const gainNode = audioCtx.createGain();

        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        self.gainNode = gainNode;
    } catch (e) {
        console.error('Web Audio API is not supported in this browser', e);
    }
}

export default HtmlAudioPlayer;
