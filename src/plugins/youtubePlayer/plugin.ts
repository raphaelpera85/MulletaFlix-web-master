import browser from '../../scripts/browser';
import { appRouter } from '../../components/router/appRouter';
import loading from '../../components/loading/loading';
import { setBackdropTransparency, TRANSPARENCY_LEVEL } from '../../components/backdrop/backdrop';
import { PluginType } from '../../types/plugin.ts';
import Events from '../../utils/events.ts';

interface YoutubeApiPlayer {
    setSize(width: number, height: number): void;
    destroy(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    pauseVideo(): void;
    playVideo(): void;
    getPlayerState(): number;
    setVolume(volume: number): void;
    getVolume(): number;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
}

interface YoutubeApi {
    Player: new (elementId: string, options: any) => YoutubeApiPlayer;
    PlayerState: {
        PLAYING: number;
        ENDED: number;
        PAUSED: number;
    };
}

interface YoutubeOnStateChangeEvent {
    target: YoutubeApiPlayer;
    data: number;
}

interface YoutubeOnErrorEvent {
    data: number;
}

declare const YT: YoutubeApi;

const errorCodes: Record<number, string> = {
    2: 'YoutubeBadRequest',
    5: 'YoutubePlaybackError',
    100: 'YoutubeNotFound',
    101: 'YoutubeDenied',
    150: 'YoutubeDenied'
};

interface YoutubePlayerInstance {
    started?: boolean;
    videoDialog?: HTMLDivElement;
    currentYoutubePlayer?: YoutubeApiPlayer | null;
    _currentSrc?: string | null;
    timeUpdateInterval?: ReturnType<typeof setInterval> | null;
    resizeListener?: EventListener | null;
    _hlsPlayer?: unknown;
}

interface PlayOptions {
    url: string;
    fullscreen?: boolean;
}

function zoomIn(elem: HTMLDivElement, iterations: number): Animation {
    const keyframes: Keyframe[] = [
        { transform: 'scale3d(.2, .2, .2)  ', opacity: '.6', offset: 0 },
        { transform: 'none', opacity: '1', offset: 1 }
    ];

    const timing: KeyframeAnimationOptions = { duration: 240, iterations: iterations };
    return elem.animate(keyframes, timing);
}

function createMediaElement(instance: YoutubePlayerInstance, options: PlayOptions): Promise<HTMLDivElement> {
    return new Promise(function (resolve) {
        const dlg = document.querySelector('.youtubePlayerContainer') as HTMLDivElement | null;

        if (!dlg) {
            import('./style.scss').then(() => {
                loading.show();

                const playerDlg = document.createElement('div');

                playerDlg.classList.add('youtubePlayerContainer');

                if (options.fullscreen) {
                    playerDlg.classList.add('onTop');
                }

                playerDlg.innerHTML = '<div id="player"></div>';
                const videoElement = playerDlg.querySelector('#player') as HTMLDivElement;

                document.body.insertBefore(playerDlg, document.body.firstChild);
                instance.videoDialog = playerDlg;

                if (options.fullscreen) {
                    document.body.classList.add('hide-scroll');
                }

                if (options.fullscreen && typeof playerDlg.animate === 'function' && !browser.slow) {
                    zoomIn(playerDlg, 1).onfinish = function (): void {
                        resolve(videoElement);
                    };
                } else {
                    resolve(videoElement);
                }
            });
        } else {
            // we need to hide scrollbar when starting playback from page with animated background
            if (options.fullscreen) {
                document.body.classList.add('hide-scroll');
            }

            resolve(dlg.querySelector('#player') as HTMLDivElement);
        }
    });
}

function onVideoResize(this: YoutubePlayerInstance): void {
    const instance = this;
    const player = instance.currentYoutubePlayer;
    const dlg = instance.videoDialog;
    if (player && dlg) {
        player.setSize(dlg.offsetWidth, dlg.offsetHeight);
    }
}

function clearTimeUpdateInterval(instance: YoutubePlayerInstance): void {
    if (instance.timeUpdateInterval) {
        clearInterval(instance.timeUpdateInterval);
    }
    instance.timeUpdateInterval = null;
}

function onEndedInternal(instance: YoutubePlayerInstance): void {
    clearTimeUpdateInterval(instance);
    const resizeListener = instance.resizeListener;
    if (resizeListener) {
        window.removeEventListener('resize', resizeListener);
        window.removeEventListener('orientationChange', resizeListener);
        instance.resizeListener = null;
    }

    const stopInfo = {
        src: instance._currentSrc
    };

    Events.trigger(instance, 'stopped', [stopInfo]);

    instance._currentSrc = null;
    if (instance.currentYoutubePlayer) {
        instance.currentYoutubePlayer.destroy();
    }
    instance.currentYoutubePlayer = null;
}

// 4. The API will call this function when the video player is ready.
function onPlayerReady(event: YoutubeOnStateChangeEvent): void {
    event.target.playVideo();
}

function onTimeUpdate(this: YoutubePlayerInstance): void {
    Events.trigger(this, 'timeupdate');
}

function onPlaying(instance: YoutubePlayerInstance, playOptions: PlayOptions, resolve: () => void): void {
    if (!instance.started) {
        instance.started = true;
        resolve();
        clearTimeUpdateInterval(instance);
        instance.timeUpdateInterval = setInterval(onTimeUpdate.bind(instance), 500);

        if (playOptions.fullscreen) {
            appRouter.showVideoOsd().then(function () {
                instance.videoDialog!.classList.remove('onTop');
            });
        } else {
            setBackdropTransparency(TRANSPARENCY_LEVEL.Backdrop);
            instance.videoDialog!.classList.remove('onTop');
        }

        loading.hide();
    }
}

function setCurrentSrc(instance: YoutubePlayerInstance, elem: HTMLDivElement, options: PlayOptions): Promise<void> {
    return new Promise(function (resolve, reject) {
        instance._currentSrc = options.url;
        const params = new URLSearchParams(options.url.split('?')[1]);
        // 3. This function creates an <iframe> (and YouTube player)
        //    after the API code downloads.
        (window as any)['onYouTubeIframeAPIReady'] = function (): void {
            instance.currentYoutubePlayer = new YT.Player('player', {
                height: instance.videoDialog!.offsetHeight,
                width: instance.videoDialog!.offsetWidth,
                videoId: params.get('v')!,
                events: {
                    'onReady': onPlayerReady as any,
                    'onStateChange': function (event: YoutubeOnStateChangeEvent) {
                        if (event.data === YT.PlayerState.PLAYING) {
                            onPlaying(instance, options, resolve);
                        } else if (event.data === YT.PlayerState.ENDED) {
                            onEndedInternal(instance);
                        } else if (event.data === YT.PlayerState.PAUSED) {
                            Events.trigger(instance, 'pause');
                        }
                    },
                    'onError': (e: YoutubeOnErrorEvent) => reject(errorCodes[e.data] || 'ErrorDefault')
                },
                playerVars: {
                    controls: 0,
                    enablejsapi: 1,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    fs: 0,
                    playsinline: 1
                }
            });

            let resizeListener = instance.resizeListener;
            if (resizeListener) {
                window.removeEventListener('resize', resizeListener);
                window.addEventListener('resize', resizeListener);
            } else {
                resizeListener = instance.resizeListener = onVideoResize.bind(instance) as EventListener;
                window.addEventListener('resize', resizeListener);
            }
            window.removeEventListener('orientationChange', resizeListener);
            window.addEventListener('orientationChange', resizeListener);
        };

        if (!(window as any)['YT']) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);
        } else {
            ((window as any)['onYouTubeIframeAPIReady'] as () => void)();
        }
    });
}

class YoutubePlayer {
    name: string;
    type: PluginType;
    id: string;
    priority: number;
    started!: boolean;
    videoDialog!: HTMLDivElement;
    currentYoutubePlayer!: YoutubeApiPlayer;
    _currentSrc!: string | null;
    timeUpdateInterval: ReturnType<typeof setInterval> | null = null;
    resizeListener: EventListener | null = null;

    constructor() {
        this.name = 'Youtube Player';
        this.type = PluginType.MediaPlayer;
        this.id = 'youtubeplayer';

        // Let any players created by plugins take priority
        this.priority = 1;
    }

    play(options: PlayOptions): Promise<void> {
        this.started = false;
        const instance = this;

        return createMediaElement(this, options).then(function (elem) {
            return setCurrentSrc(instance, elem, options);
        });
    }

    stop(destroyPlayer?: boolean): Promise<void> {
        const src = this._currentSrc;

        if (src) {
            if (this.currentYoutubePlayer) {
                this.currentYoutubePlayer.stopVideo();
            }
            onEndedInternal(this);

            if (destroyPlayer) {
                this.destroy();
            }
        }

        return Promise.resolve();
    }

    destroy(): void {
        setBackdropTransparency(TRANSPARENCY_LEVEL.None);
        document.body.classList.remove('hide-scroll');

        const dlg = this.videoDialog;
        if (dlg) {
            this.videoDialog = null!;

            dlg.parentNode!.removeChild(dlg);
        }
    }

    canPlayMediaType(mediaType: string): boolean {
        mediaType = (mediaType || '').toLowerCase();

        return mediaType === 'audio' || mediaType === 'video';
    }

    canPlayItem(): boolean {
        // Does not play server items
        return false;
    }

    canPlayUrl(url: string): boolean {
        return url.toLowerCase().indexOf('youtube.com') !== -1;
    }

    getDeviceProfile(): Promise<object> {
        return Promise.resolve({});
    }

    currentSrc(): string | null | undefined {
        return this._currentSrc;
    }

    setSubtitleStreamIndex(): void {
        // not supported
    }

    canSetAudioStreamIndex(): boolean {
        return false;
    }

    setAudioStreamIndex(): void {
        // not supported
    }

    // Save this for when playback stops, because querying the time at that point might return 0
    currentTime(val?: number): number | undefined {
        const currentYoutubePlayer = this.currentYoutubePlayer;

        if (currentYoutubePlayer) {
            if (val != null) {
                currentYoutubePlayer.seekTo(val / 1000, true);
                return;
            }

            return currentYoutubePlayer.getCurrentTime() * 1000;
        }
    }

    duration(): number | null {
        const currentYoutubePlayer = this.currentYoutubePlayer;

        if (currentYoutubePlayer) {
            return currentYoutubePlayer.getDuration() * 1000;
        }
        return null;
    }

    pause(): void {
        const currentYoutubePlayer = this.currentYoutubePlayer;

        if (currentYoutubePlayer) {
            currentYoutubePlayer.pauseVideo();

            const instance = this;

            // This needs a delay before the youtube player will report the correct player state
            setTimeout(function () {
                Events.trigger(instance, 'pause');
            }, 200);
        }
    }

    unpause(): void {
        const currentYoutubePlayer = this.currentYoutubePlayer;

        if (currentYoutubePlayer) {
            currentYoutubePlayer.playVideo();

            const instance = this;

            // This needs a delay before the youtube player will report the correct player state
            setTimeout(function () {
                Events.trigger(instance, 'unpause');
            }, 200);
        }
    }

    paused(): boolean {
        const currentYoutubePlayer = this.currentYoutubePlayer;

        if (currentYoutubePlayer) {
            return currentYoutubePlayer.getPlayerState() === 2;
        }

        return false;
    }

    volume(val?: number): number | undefined {
        if (val != null) {
            this.setVolume(val);
            return;
        }

        return this.getVolume();
    }

    setVolume(val: number): void {
        const currentYoutubePlayer = this.currentYoutubePlayer;

        if (currentYoutubePlayer && val != null) {
            currentYoutubePlayer.setVolume(val);
        }
    }

    getVolume(): number | undefined {
        const currentYoutubePlayer = this.currentYoutubePlayer;

        if (currentYoutubePlayer) {
            return currentYoutubePlayer.getVolume();
        }
    }

    setMute(mute: boolean): void {
        const currentYoutubePlayer = this.currentYoutubePlayer;

        if (mute) {
            if (currentYoutubePlayer) {
                currentYoutubePlayer.mute();
            }
        } else if (currentYoutubePlayer) {
            currentYoutubePlayer.unMute();
        }
    }

    isMuted(): boolean | undefined {
        const currentYoutubePlayer = this.currentYoutubePlayer;

        if (currentYoutubePlayer) {
            return currentYoutubePlayer.isMuted();
        }
    }
}

export default YoutubePlayer;
