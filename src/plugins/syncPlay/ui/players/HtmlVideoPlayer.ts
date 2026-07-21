import NoActivePlayer from './NoActivePlayer';
import Events from '../../../../utils/events.ts';

class HtmlVideoPlayer extends NoActivePlayer {
    static type = 'htmlvideoplayer';

    private isPlayerActive = false;

    private savedPlaybackRate = 1.0;

    private minBufferingThresholdMillis = 3000;

    private notifyBuffering: ReturnType<typeof setTimeout> | null = null;

    private _onPlaybackStart: any;
    private _onPlaybackStop: any;
    private _onUnpause: any;
    private _onPause: any;
    private _onTimeUpdate: any;
    private _onPlaying: any;
    private _onWaiting: any;

    currentTimeAsync?: () => Promise<number>;

    constructor(player: any, syncPlayManager: any) {
        super(player, syncPlayManager);

        if (player.currentTimeAsync) {
            this.currentTimeAsync = () => {
                if (this.player.currentTimeAsync) {
                    return this.player.currentTimeAsync();
                }

                return Promise.resolve(this.player.currentTime());
            };
        }
    }

    localBindToPlayer(): void {
        super.localBindToPlayer();

        this._onPlaybackStart = (player: any, state: any) => {
            this.isPlayerActive = true;
            this.onPlaybackStart(player, state);
        };

        this._onPlaybackStop = (stopInfo: any) => {
            this.isPlayerActive = false;
            this.onPlaybackStop(stopInfo);
        };

        this._onUnpause = (): void => {
            this.onUnpause();
        };

        this._onPause = (): void => {
            this.onPause();
        };

        this._onTimeUpdate = (e: Event): void => {
            const currentTime = new Date();
            const currentPosition = this.player.currentTime();
            this.onTimeUpdate(e, {
                currentTime,
                currentPosition
            });
        };

        this._onPlaying = (): void => {
            if (this.notifyBuffering) {
                clearTimeout(this.notifyBuffering);
            }
            this.onReady();
        };

        this._onWaiting = (): void => {
            if (this.notifyBuffering) {
                clearTimeout(this.notifyBuffering);
            }
            this.notifyBuffering = setTimeout(() => {
                this.onBuffering();
            }, this.minBufferingThresholdMillis);
        };

        Events.on(this.player, 'playbackstart', this._onPlaybackStart);
        Events.on(this.player, 'playbackstop', this._onPlaybackStop);
        Events.on(this.player, 'unpause', this._onUnpause);
        Events.on(this.player, 'pause', this._onPause);
        Events.on(this.player, 'timeupdate', this._onTimeUpdate);
        Events.on(this.player, 'playing', this._onPlaying);
        Events.on(this.player, 'waiting', this._onWaiting);

        this.savedPlaybackRate = this.player.getPlaybackRate();
    }

    localUnbindFromPlayer(): void {
        super.localUnbindFromPlayer();

        Events.off(this.player, 'playbackstart', this._onPlaybackStart);
        Events.off(this.player, 'playbackstop', this._onPlaybackStop);
        Events.off(this.player, 'unpause', this._onUnpause);
        Events.off(this.player, 'pause', this._onPause);
        Events.off(this.player, 'timeupdate', this._onTimeUpdate);
        Events.off(this.player, 'playing', this._onPlaying);
        Events.off(this.player, 'waiting', this._onWaiting);

        this.player.setPlaybackRate(this.savedPlaybackRate);
    }

    onQueueUpdate(): void {
        Events.trigger(this.player, 'playlistitemadd');
    }

    isPlaybackActive(): boolean {
        return this.isPlayerActive;
    }

    isPlaying(): boolean {
        return !this.player.paused();
    }

    currentTime(): number {
        return this.player.currentTime();
    }

    hasPlaybackRate(): boolean {
        return true;
    }

    setPlaybackRate(value: number): void {
        this.player.setPlaybackRate(value);
    }

    getPlaybackRate(): number {
        return this.player.getPlaybackRate();
    }
}

export default HtmlVideoPlayer;
