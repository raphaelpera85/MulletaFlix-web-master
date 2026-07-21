import appSettings from '../scripts/settings/appSettings';
import browser from '../scripts/browser';
import Events from '../utils/events';
import { MediaError } from 'types/mediaError';

interface MediaSource {
    IsRemote?: boolean;
    MediaStreams?: Array<{ Codec?: string; [key: string]: any }>;
    IsLocal?: boolean;
    RunTimeTicks?: number;
    MediaType?: string;
    [key: string]: any;
}

interface ApplySrcOptions {
    mediaSource?: MediaSource;
    url?: string;
    playerStartPositionTicks?: number;
    [key: string]: any;
}

interface BufferedRange {
    start: number;
    end: number;
}

interface HlsInstance {
    _hlsPlayer?: any;
    _flvPlayer?: any;
    _castPlayer?: any;
    _mediaElement?: HTMLMediaElement;
    _currentSrc?: string | null;
    _currentTime?: number | null;
    _currentPlayOptions?: any;
    destroyCustomTrack?: (elem: HTMLMediaElement) => void;
    [key: string]: any;
}

export function getSavedVolume(): number {
    return (appSettings.get('volume') as unknown as number) || 1;
}

export function saveVolume(value: number): void {
    if (value) {
        appSettings.set('volume', String(value));
    }
}

export function getCrossOriginValue(mediaSource: MediaSource): string | null {
    if (mediaSource.IsRemote) {
        return null;
    }

    return 'anonymous';
}

function canPlayNativeHls(): boolean {
    const media = document.createElement('video');

    return !!(media.canPlayType('application/x-mpegURL').replace(/no/, '')
            || media.canPlayType('application/vnd.apple.mpegURL').replace(/no/, ''));
}

export function enableHlsJsPlayerForCodecs(mediaSource: MediaSource, mediaType: string): boolean {
    // Workaround for VP9 HLS support on desktop Safari
    // Force using HLS.js because desktop Safari's native HLS player does not play VP9 over HLS
    // browser.osx will return true on iPad, cannot use
    if (!browser.iOS && browser.safari && mediaSource.MediaStreams?.some(x => x.Codec === 'vp9')) {
        return true;
    }
    return enableHlsJsPlayer(mediaSource.RunTimeTicks, mediaType);
}

export function enableHlsJsPlayer(runTimeTicks?: number | null, mediaType?: string): boolean {
    if (window.MediaSource == null) {
        return false;
    }

    // hls.js is only in beta. needs more testing.
    if (browser.iOS) {
        return false;
    }

    // The native players on these devices support seeking live streams, no need to use hls.js here
    if (browser.tizen || browser.web0s) {
        return false;
    }

    if (canPlayNativeHls()) {
        // Android Webview's native HLS has performance and compatiblity issues
        if (browser.android && (mediaType === 'Audio' || mediaType === 'Video')) {
            return true;
        }

        // Chromium 141+ brings native HLS support that does not support switching HDR/SDR playlists.
        // Always use hls.js to avoid falling back to transcoding from remuxing and client side tone-mapping.
        if (browser.chrome || browser.edgeChromium || browser.opera) {
            return true;
        }

        // simple playback should use the native support
        if (runTimeTicks) {
            return false;
        }
    }

    return true;
}

let recoverDecodingErrorDate: number | undefined;
let recoverSwapAudioCodecDate: number | undefined;
export function handleHlsJsMediaError(instance: HlsInstance, reject?: (() => void) | null): void {
    const hlsPlayer = instance._hlsPlayer;

    if (!hlsPlayer) {
        return;
    }

    let now: number = Date.now();

    if ((window as any).performance?.now) {
        now = performance.now();
    }

    if (!recoverDecodingErrorDate || (now - recoverDecodingErrorDate) > 3000) {
        recoverDecodingErrorDate = now;
        console.debug('try to recover media Error ...');
        hlsPlayer.recoverMediaError();
    } else if (!recoverSwapAudioCodecDate || (now - recoverSwapAudioCodecDate) > 3000) {
        recoverSwapAudioCodecDate = now;
        console.debug('try to swap Audio Codec and recover media Error ...');
        hlsPlayer.swapAudioCodec();
        hlsPlayer.recoverMediaError();
    } else {
        console.error('cannot recover, last media error recovery failed ...');

        if (reject) {
            reject();
        } else {
            onErrorInternal(instance, MediaError.FATAL_HLS_ERROR as unknown as number);
        }
    }
}

export function onErrorInternal(instance: HlsInstance, type: number): void {
    // Needed for video
    if (instance.destroyCustomTrack) {
        instance.destroyCustomTrack(instance._mediaElement!);
    }

    Events.trigger(instance, 'error', [{ type }]);
}

export function isValidDuration(duration: number | undefined | null): boolean {
    return !!duration
            && !isNaN(duration)
            && duration !== Number.POSITIVE_INFINITY
            && duration !== Number.NEGATIVE_INFINITY;
}

function setCurrentTimeIfNeeded(element: HTMLMediaElement, seconds: number): void {
    // If it's worth skipping (1 sec or less of a difference)
    if (Math.abs((element.currentTime || 0) - seconds) >= 1) {
        element.currentTime = seconds;
    }
}

export function seekOnPlaybackStart(instance: HlsInstance, element: HTMLMediaElement, ticks: number | undefined | null, onMediaReady?: () => void): void {
    const seconds = (ticks || 0) / 10000000;

    if (seconds) {
        // Appending #t=xxx to the query string doesn't seem to work with HLS
        // For plain video files, not all browsers support it either

        if (element.duration >= seconds) {
            // media is ready, seek immediately
            setCurrentTimeIfNeeded(element, seconds);
            if (onMediaReady) onMediaReady();
        } else {
            // update video player position when media is ready to be sought
            const events = ['durationchange', 'loadeddata', 'play', 'loadedmetadata'];
            const onMediaChange = function(e: Event) {
                if (element.currentTime === 0 && element.duration >= seconds) {
                    // seek only when video position is exactly zero,
                    // as this is true only if video hasn't started yet or
                    // user rewound to the very beginning
                    // (but rewinding cannot happen as the first event with media of non-empty duration)
                    console.debug(`seeking to ${seconds} on ${(e as Event).type} event`);
                    setCurrentTimeIfNeeded(element, seconds);
                    events.forEach(name => {
                        element.removeEventListener(name, onMediaChange);
                    });
                    if (onMediaReady) onMediaReady();
                }
            };
            events.forEach(name => {
                element.addEventListener(name, onMediaChange);
            });
        }
    }
}

export function applySrc(elem: HTMLMediaElement, src: string, options: ApplySrcOptions): Promise<void> {
    if ((window as any).Windows && options.mediaSource?.IsLocal) {
        return (window as any).Windows.Storage.StorageFile.getFileFromPathAsync(options.url).then(function (file: any) {
            const playlist = new (window as any).Windows.Media.Playback.MediaPlaybackList();

            const source1 = (window as any).Windows.Media.Core.MediaSource.createFromStorageFile(file);
            const startTime = (options.playerStartPositionTicks || 0) / 10000;
            playlist.items.append(new (window as any).Windows.Media.Playback.MediaPlaybackItem(source1, startTime));
            elem.src = URL.createObjectURL(playlist);
            return Promise.resolve();
        });
    } else {
        elem.src = src;
    }

    return Promise.resolve();
}

export function resetSrc(elem: HTMLMediaElement): void {
    elem.src = '';
    elem.innerHTML = '';
    elem.removeAttribute('src');
}

function onSuccessfulPlay(elem: HTMLMediaElement, onErrorFn: (e: Event) => void): void {
    elem.addEventListener('error', onErrorFn);
}

export function playWithPromise(elem: HTMLMediaElement, onErrorFn: (e: Event) => void): Promise<void> {
    try {
        return elem.play()
            .catch((e: any) => {
                const errorName = (e.name || '').toLowerCase();
                // safari uses aborterror
                if (errorName === 'notallowederror'
                        || errorName === 'aborterror') {
                    // swallow this error because the user can still click the play button on the video element
                    return Promise.resolve();
                }
                return Promise.reject(e);
            })
            .then(() => {
                onSuccessfulPlay(elem, onErrorFn);
                return Promise.resolve();
            });
    } catch (err) {
        console.error('error calling video.play: ' + err);
        return Promise.reject();
    }
}

export function destroyCastPlayer(instance: HlsInstance): void {
    const player = instance._castPlayer;
    if (player) {
        try {
            player.unload();
        } catch (err) {
            console.error(err);
        }

        instance._castPlayer = null;
    }
}

export function destroyHlsPlayer(instance: HlsInstance): void {
    const player = instance._hlsPlayer;
    if (player) {
        try {
            player.destroy();
        } catch (err) {
            console.error(err);
        }

        instance._hlsPlayer = null;
    }
}

export function destroyFlvPlayer(instance: HlsInstance): void {
    const player = instance._flvPlayer;
    if (player) {
        try {
            player.unload();
            player.detachMediaElement();
            player.destroy();
        } catch (err) {
            console.error(err);
        }

        instance._flvPlayer = null;
    }
}

export function bindEventsToHlsPlayer(instance: HlsInstance, hls: any, elem: HTMLMediaElement, onErrorFn: (e: Event) => void, resolve: () => void, reject?: ((code?: number) => void) | null): void {
    hls.on('MANIFEST_PARSED', function () {
        playWithPromise(elem, onErrorFn).then(resolve, function () {
            if (reject) {
                reject();
                reject = null;
            }
        });
    });

    hls.on('ERROR', function (_event: any, data: any) {
        console.error('HLS Error: Type: ' + data.type + ' Details: ' + (data.details || '') + ' Fatal: ' + (data.fatal || false));

        // try to recover network error
        if (data.type === 'networkError'
                && data.response?.code && data.response.code >= 400
        ) {
            console.debug('hls.js response error code: ' + data.response.code);

            // Trigger failure differently depending on whether this is prior to start of playback, or after
            hls.destroy();

            if (reject) {
                reject(MediaError.SERVER_ERROR as unknown as number);
                reject = null;
            } else {
                onErrorInternal(instance, MediaError.SERVER_ERROR as unknown as number);
            }

            return;
        }

        if (data.fatal) {
            switch (data.type) {
                case 'networkError':

                    if (data.response && data.response.code === 0) {
                        // This could be a CORS error related to access control response headers

                        console.debug('hls.js response error code: ' + data.response.code);

                        // Trigger failure differently depending on whether this is prior to start of playback, or after
                        hls.destroy();

                        if (reject) {
                            reject(MediaError.NETWORK_ERROR as unknown as number);
                            reject = null;
                        } else {
                            onErrorInternal(instance, MediaError.NETWORK_ERROR as unknown as number);
                        }
                    } else {
                        console.debug('fatal network error encountered, try to recover');
                        hls.startLoad();
                    }

                    break;
                case 'mediaError':
                    console.debug('fatal media error encountered, try to recover');
                    handleHlsJsMediaError(instance, reject as (() => void) | null);
                    reject = null;
                    break;
                default:

                    console.debug('Cannot recover from hls error - destroy and trigger error');
                    // cannot recover
                    // Trigger failure differently depending on whether this is prior to start of playback, or after
                    hls.destroy();

                    if (reject) {
                        reject();
                        reject = null;
                    } else {
                        onErrorInternal(instance, MediaError.FATAL_HLS_ERROR as unknown as number);
                    }
                    break;
            }
        }
    });
}

export function onEndedInternal(instance: HlsInstance, elem: HTMLMediaElement, onErrorFn: (e: Event) => void): void {
    elem.removeEventListener('error', onErrorFn);

    resetSrc(elem);

    destroyHlsPlayer(instance);
    destroyFlvPlayer(instance);
    destroyCastPlayer(instance);

    const stopInfo = {
        src: instance._currentSrc
    };

    Events.trigger(instance, 'stopped', [stopInfo]);

    instance._currentTime = null;
    instance._currentSrc = null;
    instance._currentPlayOptions = null;
}

export function getBufferedRanges(instance: HlsInstance, elem: HTMLMediaElement): BufferedRange[] {
    const ranges: BufferedRange[] = [];
    const seekable = elem.buffered || [];

    let offset: number | undefined;
    const currentPlayOptions = instance._currentPlayOptions;
    if (currentPlayOptions) {
        offset = currentPlayOptions.transcodingOffsetTicks;
    }

    offset = offset || 0;

    for (let i = 0, length = seekable.length; i < length; i++) {
        let start = seekable.start(i);
        let end = seekable.end(i);

        if (!isValidDuration(start)) {
            start = 0;
        }
        if (!isValidDuration(end)) {
            // eslint-disable-next-line sonarjs/no-dead-store
            end = 0;
            continue;
        }

        ranges.push({
            start: (start * 10000000) + offset,
            end: (end * 10000000) + offset
        });
    }

    return ranges;
}
