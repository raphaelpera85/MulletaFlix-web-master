import { getImageUrl } from 'apps/stable/features/playback/utils/image';
import { getItemTextLines } from 'apps/stable/features/playback/utils/itemText';
import { appRouter, isLyricsPage } from 'components/router/appRouter';
import { AppFeature } from 'constants/appFeature';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import datetime from '../../scripts/datetime';
import Events from '../../utils/events.ts';
import browser from '../../scripts/browser';
import imageLoader from '../images/imageLoader';
import layoutManager from '../layoutManager';
import { playbackManager } from '../playback/playbackmanager';
import { appHost } from '../apphost';
import dom from '../../utils/dom';
import globalize from 'lib/globalize';
import itemContextMenu from '../itemContextMenu';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-ratingbutton/emby-ratingbutton';
import appFooter from '../appFooter/appFooter';
import itemShortcuts from '../shortcuts';
import './nowPlayingBar.scss';
import '../../elements/emby-slider/emby-slider';

let currentPlayer: any = null;
let currentPlayerSupportedCommands: string[] = [];

let currentTimeElement: HTMLElement | null = null;
let nowPlayingImageElement: HTMLElement | null = null;
let nowPlayingImageUrl: string | null = null;
let nowPlayingTextElement: HTMLElement | null = null;
let nowPlayingUserData: HTMLElement | null = null;
let muteButton: HTMLButtonElement | null = null;
let volumeSlider: (HTMLInputElement & { dragging?: boolean }) | null = null;
let volumeSliderContainer: HTMLElement | null = null;
let playPauseButtons: NodeListOf<HTMLButtonElement> | null = null;
let positionSlider: (HTMLInputElement & {
    dragging?: boolean;
    setIsClear?: (value: boolean) => void;
    setBufferedRanges?: (bufferedRanges: any, runtimeTicks: number | null | undefined, positionTicks: number | null | undefined) => void;
    getBubbleText?: (value: number, text?: string) => string;
}) | null = null;
let toggleAirPlayButton: HTMLButtonElement | null = null;
let toggleRepeatButton: HTMLButtonElement | null = null;
let toggleRepeatButtonIcon: HTMLElement | null = null;
let lyricButton: HTMLButtonElement | null = null;

let lastUpdateTime = 0;
let lastPlayerState: any = {};
let isEnabled: boolean = false;
let currentRuntimeTicks = 0;

let isVisibilityAllowed = true;

let isLyricPageActive = false;

function getNowPlayingBarHtml() {
    let html = '';

    html += '<div class="nowPlayingBar hide nowPlayingBar-hidden">';

    html += '<div class="nowPlayingBarTop">';
    html += '<div class="nowPlayingBarPositionContainer sliderContainer" dir="ltr">';
    html += '<input type="range" is="emby-slider" pin step=".01" min="0" max="100" value="0" class="slider-medium-thumb nowPlayingBarPositionSlider" data-slider-keep-progress="true"/>';
    html += '</div>';

    html += '<div class="nowPlayingBarInfoContainer">';
    html += '<div class="nowPlayingImage"></div>';
    html += '<div class="nowPlayingBarText"></div>';
    html += '</div>';

    // The onclicks are needed due to the return false above
    html += '<div class="nowPlayingBarCenter" dir="ltr">';

    html += `<button is="paper-icon-button-light" class="previousTrackButton mediaButton" title="${globalize.translate('ButtonPreviousTrack')}"><span class="material-icons skip_previous" aria-hidden="true"></span></button>`;

    html += `<button is="paper-icon-button-light" class="playPauseButton mediaButton" title="${globalize.translate('ButtonPause')}"><span class="material-icons pause" aria-hidden="true"></span></button>`;

    html += `<button is="paper-icon-button-light" class="stopButton mediaButton" title="${globalize.translate('ButtonStop')}"><span class="material-icons stop" aria-hidden="true"></span></button>`;
    if (!layoutManager.mobile) {
        html += `<button is="paper-icon-button-light" class="nextTrackButton mediaButton" title="${globalize.translate('ButtonNextTrack')}"><span class="material-icons skip_next" aria-hidden="true"></span></button>`;
    }

    html += '<div class="nowPlayingBarCurrentTime"></div>';
    html += '</div>';

    html += '<div class="nowPlayingBarRight">';

    html += `<button is="paper-icon-button-light" class="muteButton mediaButton" title="${globalize.translate('Mute')}"><span class="material-icons volume_up" aria-hidden="true"></span></button>`;

    html += '<div class="sliderContainer nowPlayingBarVolumeSliderContainer hide" style="width:9em;vertical-align:middle;display:inline-flex;">';
    html += '<input type="range" is="emby-slider" pin step="1" min="0" max="100" value="0" class="slider-medium-thumb nowPlayingBarVolumeSlider"/>';
    html += '</div>';

    html += `<button is="paper-icon-button-light" class="btnAirPlay mediaButton" title="${globalize.translate('AirPlay')}"><span class="material-icons airplay" aria-hidden="true"></span></button>`;

    html += `<button is="paper-icon-button-light" class="openLyricsButton mediaButton hide" title="${globalize.translate('Lyrics')}"><span class="material-icons lyrics" style="top:0.1em" aria-hidden="true"></span></button>`;

    html += `<button is="paper-icon-button-light" class="toggleRepeatButton mediaButton" title="${globalize.translate('Repeat')}"><span class="material-icons repeat" aria-hidden="true"></span></button>`;
    html += `<button is="paper-icon-button-light" class="btnShuffleQueue mediaButton" title="${globalize.translate('Shuffle')}"><span class="material-icons shuffle" aria-hidden="true"></span></button>`;

    html += '<div class="nowPlayingBarUserDataButtons">';
    html += '</div>';

    html += `<button is="paper-icon-button-light" class="playPauseButton mediaButton" title="${globalize.translate('ButtonPause')}"><span class="material-icons pause" aria-hidden="true"></span></button>`;
    if (layoutManager.mobile) {
        html += `<button is="paper-icon-button-light" class="nextTrackButton mediaButton" title="${globalize.translate('ButtonNextTrack')}"><span class="material-icons skip_next" aria-hidden="true"></span></button>`;
    } else {
        html += `<button is="paper-icon-button-light" class="btnToggleContextMenu mediaButton" title="${globalize.translate('ButtonMore')}"><span class="material-icons more_vert" aria-hidden="true"></span></button>`;
    }

    html += '</div>';
    html += '</div>';

    html += '</div>';

    return html;
}

function onSlideDownComplete(this: HTMLElement): void {
    this.classList.add('hide');
}

function slideDown(elem: HTMLElement): void {
    // trigger reflow
    void elem.offsetWidth;

    elem.classList.add('nowPlayingBar-hidden');

    dom.addEventListener(elem, dom.whichTransitionEvent(), onSlideDownComplete, {
        once: true
    });
}

function slideUp(elem: HTMLElement): void {
    dom.removeEventListener(elem, dom.whichTransitionEvent(), onSlideDownComplete, {
        once: true
    });

    elem.classList.remove('hide');

    // trigger reflow
    void elem.offsetWidth;

    elem.classList.remove('nowPlayingBar-hidden');
}

function onPlayPauseClick(): void {
    playbackManager.playPause(currentPlayer);
}

function bindEvents(elem: HTMLElement): void {
    currentTimeElement = elem.querySelector('.nowPlayingBarCurrentTime') as HTMLElement | null;
    nowPlayingImageElement = elem.querySelector('.nowPlayingImage') as HTMLElement | null;
    nowPlayingTextElement = elem.querySelector('.nowPlayingBarText') as HTMLElement | null;
    nowPlayingUserData = elem.querySelector('.nowPlayingBarUserDataButtons') as HTMLElement | null;
    positionSlider = elem.querySelector('.nowPlayingBarPositionSlider') as HTMLInputElement & {
        dragging?: boolean;
        setIsClear?: (value: boolean) => void;
        setBufferedRanges?: (bufferedRanges: any, runtimeTicks: number | null | undefined, positionTicks: number | null | undefined) => void;
        getBubbleText?: (value: number, text?: string) => string;
    } | null;
    muteButton = elem.querySelector('.muteButton') as HTMLButtonElement | null;
    playPauseButtons = elem.querySelectorAll('.playPauseButton') as NodeListOf<HTMLButtonElement>;
    toggleRepeatButton = elem.querySelector('.toggleRepeatButton') as HTMLButtonElement | null;
    volumeSlider = elem.querySelector('.nowPlayingBarVolumeSlider') as HTMLInputElement & { dragging?: boolean } | null;
    volumeSliderContainer = elem.querySelector('.nowPlayingBarVolumeSliderContainer') as HTMLElement | null;
    lyricButton = nowPlayingBarElement?.querySelector('.openLyricsButton') as HTMLButtonElement | null;

    if (!currentTimeElement || !nowPlayingTextElement || !nowPlayingUserData || !positionSlider || !muteButton || !playPauseButtons || !toggleRepeatButton || !volumeSlider || !volumeSliderContainer || !lyricButton) {
        throw new Error('Missing now playing bar elements');
    }

    muteButton.addEventListener('click', function () {
        if (currentPlayer) {
            playbackManager.toggleMute(currentPlayer);
        }
    });

    (elem.querySelector('.stopButton') as HTMLButtonElement | null)?.addEventListener('click', function () {
        if (currentPlayer) {
            playbackManager.stop(currentPlayer);
        }
    });

    playPauseButtons.forEach((button) => {
        button.addEventListener('click', onPlayPauseClick);
    });

    (elem.querySelector('.nextTrackButton') as HTMLButtonElement | null)?.addEventListener('click', function () {
        if (currentPlayer) {
            playbackManager.nextTrack(currentPlayer);
        }
    });

    (elem.querySelector('.previousTrackButton') as HTMLButtonElement | null)?.addEventListener('click', function (e: MouseEvent) {
        if (currentPlayer) {
            if (playbackManager.isPlayingAudio(currentPlayer)) {
                // Cancel this event if doubleclick is fired. The actual previousTrack will be processed by the 'dblclick' event
                if (e.detail > 1 ) {
                    return;
                }

                // Return to start of track, unless we are already (almost) at the beginning. In the latter case, continue and move
                // to the previous track, unless we are at the first track so no previous track exists.
                // currentTime is in msec.

                if (playbackManager.currentTime(currentPlayer) >= 5 * 1000 || playbackManager.getCurrentPlaylistIndex(currentPlayer) <= 0) {
                    playbackManager.seekPercent(0, currentPlayer);
                    // This is done automatically by playbackManager, however, setting this here gives instant visual feedback.
                    // TODO: Check why seekPercent doesn't reflect the changes inmmediately, so we can remove this workaround.
                    positionSlider!.value = '0';
                    return;
                }
            }
            playbackManager.previousTrack(currentPlayer);
        }
    });

    (elem.querySelector('.previousTrackButton') as HTMLButtonElement | null)?.addEventListener('dblclick', function () {
        if (currentPlayer) {
            playbackManager.previousTrack(currentPlayer);
        }
    });

    toggleAirPlayButton = elem.querySelector('.btnAirPlay') as HTMLButtonElement | null;
    if (!toggleAirPlayButton) {
        throw new Error('Missing AirPlay button');
    }
    toggleAirPlayButton.addEventListener('click', function () {
        if (currentPlayer) {
            playbackManager.toggleAirPlay(currentPlayer);
        }
    });

    (elem.querySelector('.btnShuffleQueue') as HTMLButtonElement | null)?.addEventListener('click', function () {
        if (currentPlayer) {
            playbackManager.toggleQueueShuffleMode();
        }
    });

    lyricButton.addEventListener('click', function() {
        if (isLyricPageActive) {
            appRouter.back();
        } else {
            appRouter.show('lyrics');
        }
    });

    toggleRepeatButton = elem.querySelector('.toggleRepeatButton') as HTMLButtonElement | null;
    if (!toggleRepeatButton) {
        throw new Error('Missing repeat button');
    }
    toggleRepeatButton.addEventListener('click', function () {
        switch (playbackManager.getRepeatMode()) {
            case 'RepeatAll':
                playbackManager.setRepeatMode('RepeatOne');
                break;
            case 'RepeatOne':
                playbackManager.setRepeatMode('RepeatNone');
                break;
            case 'RepeatNone':
                playbackManager.setRepeatMode('RepeatAll');
        }
    });

    toggleRepeatButtonIcon = toggleRepeatButton.querySelector('.material-icons') as HTMLElement | null;
    if (!toggleRepeatButtonIcon) {
        throw new Error('Missing repeat icon');
    }

    volumeSliderContainer.classList.toggle('hide', appHost.supports(AppFeature.PhysicalVolumeControl));

    volumeSlider.addEventListener('input', (e: Event) => {
        if (currentPlayer) {
            const target = e.target as HTMLInputElement | null;
            if (target) {
                currentPlayer.setVolume(target.value);
            }
        }
    });

    positionSlider.addEventListener('change', function (this: HTMLInputElement) {
        if (currentPlayer) {
            const newPercent = parseFloat(this.value);

            playbackManager.seekPercent(newPercent, currentPlayer);
        }
    });

    positionSlider.getBubbleText = function (value: number, _text?: string): string {
        const state = lastPlayerState;

        if (!state?.NowPlayingItem || !currentRuntimeTicks) {
            return '--:--';
        }

        let ticks = currentRuntimeTicks;
        ticks /= 100;
        ticks *= value;

        return datetime.getDisplayRunningTime(ticks);
    };

    elem.addEventListener('click', function (e) {
        const target = e.target as HTMLElement | null;
        if (!target || !dom.parentWithTag(target, ['BUTTON', 'INPUT'])) {
            showRemoteControl();
        }
    });
}

function showRemoteControl(): void {
    appRouter.showNowPlaying();
}

let nowPlayingBarElement: HTMLElement | null = null;
function getNowPlayingBar(): HTMLElement {
    if (nowPlayingBarElement) {
        return nowPlayingBarElement;
    }

    const parentContainer = appFooter.element as HTMLElement | null;
    if (!parentContainer) {
        throw new Error('Missing app footer element');
    }
    nowPlayingBarElement = parentContainer.querySelector('.nowPlayingBar') as HTMLElement | null;

    if (nowPlayingBarElement) {
        return nowPlayingBarElement;
    }

    parentContainer.insertAdjacentHTML('afterbegin', getNowPlayingBarHtml());
    window.customElements.upgrade(parentContainer);

    nowPlayingBarElement = parentContainer.querySelector('.nowPlayingBar') as HTMLElement | null;

    if (!nowPlayingBarElement) {
        throw new Error('Missing now playing bar element');
    }

    if (layoutManager.mobile) {
        (nowPlayingBarElement.querySelector('.btnShuffleQueue') as HTMLElement | null)?.classList.add('hide');
        (nowPlayingBarElement.querySelector('.nowPlayingBarCenter') as HTMLElement | null)?.classList.add('hide');
    }

    if (browser.safari && browser.slow) {
        // Not handled well here. The wrong elements receive events, bar doesn't update quickly enough, etc.
        nowPlayingBarElement.classList.add('noMediaProgress');
    }

    itemShortcuts.on(nowPlayingBarElement, {});

    bindEvents(nowPlayingBarElement);

    return nowPlayingBarElement;
}

function updatePlayPauseState(isPaused: boolean): void {
    if (playPauseButtons) {
        playPauseButtons.forEach((button) => {
            const icon = button.querySelector('.material-icons') as HTMLElement | null;
            if (!icon) {
                return;
            }
            icon.classList.remove('play_arrow', 'pause');
            icon.classList.add(isPaused ? 'play_arrow' : 'pause');
            button.title = globalize.translate(isPaused ? 'Play' : 'ButtonPause');
        });
    }
}

function updatePlayerStateInternal(event: any, state: any, player: any): void {
    showNowPlayingBar();

    lastPlayerState = state;

    const playerInfo = playbackManager.getPlayerInfo();
    if (!playerInfo) {
        return;
    }

    if (!toggleRepeatButton || !toggleAirPlayButton || !toggleRepeatButtonIcon) {
        return;
    }

    const playState = state.PlayState || {};

    updatePlayPauseState(playState.IsPaused);

    const supportedCommands = playerInfo.supportedCommands;
    currentPlayerSupportedCommands = supportedCommands;

    if (supportedCommands.indexOf('SetRepeatMode') === -1) {
        toggleRepeatButton.classList.add('hide');
    } else {
        toggleRepeatButton.classList.remove('hide');
    }

    const hideAirPlayButton = supportedCommands.indexOf('AirPlay') === -1;
    toggleAirPlayButton.classList.toggle('hide', hideAirPlayButton);

    updateRepeatModeDisplay(playbackManager.getRepeatMode());
    onQueueShuffleModeChange();

    updatePlayerVolumeState(playState.IsMuted, playState.VolumeLevel);

    if (positionSlider && !positionSlider.dragging) {
        positionSlider.disabled = !playState.CanSeek;

        // determines if both forward and backward buffer progress will be visible
        const isProgressClear = state.MediaSource && state.MediaSource.RunTimeTicks == null;
        positionSlider.setIsClear?.(isProgressClear);
    }

    const nowPlayingItem = state.NowPlayingItem || {};
    updateTimeDisplay(playState.PositionTicks, nowPlayingItem.RunTimeTicks, playbackManager.getBufferedRanges(player));

    updateNowPlayingInfo(state);
    updateLyricButton(nowPlayingItem);
}

function updateRepeatModeDisplay(repeatMode: string): void {
    if (!toggleRepeatButton || !toggleRepeatButtonIcon) {
        return;
    }

    toggleRepeatButtonIcon.classList.remove('repeat', 'repeat_one');
    const cssClass = 'buttonActive';

    switch (repeatMode) {
        case 'RepeatAll':
            toggleRepeatButtonIcon.classList.add('repeat');
            toggleRepeatButton.classList.add(cssClass);
            break;
        case 'RepeatOne':
            toggleRepeatButtonIcon.classList.add('repeat_one');
            toggleRepeatButton.classList.add(cssClass);
            break;
        case 'RepeatNone':
        default:
            toggleRepeatButtonIcon.classList.add('repeat');
            toggleRepeatButton.classList.remove(cssClass);
            break;
    }
}

function updateTimeDisplay(positionTicks: number | null | undefined, runtimeTicks: number | null | undefined, bufferedRanges: any): void {
    // See bindEvents for why this is necessary
    if (positionSlider && !positionSlider.dragging) {
        if (runtimeTicks) {
            const safePositionTicks = positionTicks ?? 0;
            let pct = safePositionTicks / runtimeTicks;
            pct *= 100;

            positionSlider!.value = String(pct);
        } else {
            positionSlider!.value = '0';
        }
    }

    if (positionSlider) {
        positionSlider.setBufferedRanges?.(bufferedRanges, runtimeTicks, positionTicks);
    }

    if (currentTimeElement) {
        let timeText = positionTicks == null ? '--:--' : datetime.getDisplayRunningTime(positionTicks);
        if (runtimeTicks) {
            timeText += ' / ' + datetime.getDisplayRunningTime(runtimeTicks);
        }

        currentTimeElement.innerHTML = timeText;
    }
}

function updatePlayerVolumeState(isMuted: boolean, volumeLevel: number): void {
    const supportedCommands = currentPlayerSupportedCommands;

    let showMuteButton = true;
    let showVolumeSlider = true;

    if (supportedCommands.indexOf('ToggleMute') === -1) {
        showMuteButton = false;
    }

    if (!muteButton || !volumeSlider || !volumeSliderContainer || !currentPlayer) {
        return;
    }

    const muteButtonIcon = muteButton.querySelector('.material-icons') as HTMLElement | null;
    if (!muteButtonIcon) {
        return;
    }
    muteButtonIcon.classList.remove('volume_off', 'volume_up');
    muteButtonIcon.classList.add(isMuted ? 'volume_off' : 'volume_up');
    muteButton.title = globalize.translate(isMuted ? 'Unmute' : 'Mute');

    if (supportedCommands.indexOf('SetVolume') === -1) {
        showVolumeSlider = false;
    }

    if (currentPlayer.isLocalPlayer && appHost.supports(AppFeature.PhysicalVolumeControl)) {
        showMuteButton = false;
        showVolumeSlider = false;
    }

    muteButton.classList.toggle('hide', !showMuteButton);

    // See bindEvents for why this is necessary
    if (volumeSlider) {
        volumeSliderContainer.classList.toggle('hide', !showVolumeSlider);

        if (!volumeSlider.dragging) {
            volumeSlider.value = String(volumeLevel || 0);
        }
    }
}

function updateLyricButton(item: any): void {
    if (!isEnabled) return;

    if (!lyricButton) {
        return;
    }

    const hasLyrics = !!item && item.Type === 'Audio' && item.HasLyrics;
    lyricButton.classList.toggle('hide', !hasLyrics);
    setLyricButtonActiveStatus();
}

function setLyricButtonActiveStatus(): void {
    if (!isEnabled) return;

    if (!lyricButton) {
        return;
    }

    lyricButton.classList.toggle('buttonActive', isLyricPageActive);
}

function updateNowPlayingInfo(state: any): void {
    const nowPlayingItem = state.NowPlayingItem;

    if (!nowPlayingTextElement || !nowPlayingImageElement || !nowPlayingUserData) {
        return;
    }

    const textLines = nowPlayingItem ? getItemTextLines(nowPlayingItem) : undefined;
    nowPlayingTextElement.innerHTML = '';
    if (textLines) {
        const itemText = document.createElement('div');
        const secondaryText = document.createElement('div');
        secondaryText.classList.add('nowPlayingBarSecondaryText');
        if (textLines.length > 1 && textLines[1]) {
            const text = document.createElement('a');
            text.innerText = textLines[1];
            secondaryText.appendChild(text);
        }

        if (textLines[0]) {
            const text = document.createElement('a');
            text.innerText = textLines[0];
            itemText.appendChild(text);
        }
        nowPlayingTextElement.appendChild(itemText);
        nowPlayingTextElement.appendChild(secondaryText);
    }

    const imgHeight = 70;

    const url = nowPlayingItem ? getImageUrl(nowPlayingItem, {
        height: imgHeight
    }) : null;

    if (url !== nowPlayingImageUrl) {
        if (url) {
            nowPlayingImageUrl = url;
            imageLoader.lazyImage(nowPlayingImageElement, nowPlayingImageUrl);
            nowPlayingImageElement.style.display = '';
            nowPlayingTextElement.style.marginLeft = '';
        } else {
            nowPlayingImageUrl = null;
            nowPlayingImageElement.style.backgroundImage = '';
            nowPlayingImageElement.style.display = 'none';
            nowPlayingTextElement.style.marginLeft = '1em';
        }
    }

    if (nowPlayingItem.Id) {
        const apiClient = ServerConnections.getApiClient(nowPlayingItem.ServerId) as any;
        apiClient.getItem(apiClient.getCurrentUserId(), nowPlayingItem.Id).then(function (item: any) {
            const userData = item.UserData || {};
            const likes = userData.Likes == null ? '' : userData.Likes;
            if (!layoutManager.mobile) {
                if (!nowPlayingBarElement) {
                    return;
                }

                let contextButton = nowPlayingBarElement.querySelector('.btnToggleContextMenu') as HTMLButtonElement | null;
                if (!contextButton) {
                    return;
                }
                // We remove the previous event listener by replacing the item in each update event
                const contextButtonClone = contextButton.cloneNode(true);
                const parentNode = contextButton.parentNode;
                if (!parentNode) {
                    return;
                }
                parentNode.replaceChild(contextButtonClone, contextButton);
                contextButton = nowPlayingBarElement.querySelector('.btnToggleContextMenu') as HTMLButtonElement | null;
                if (!contextButton) {
                    return;
                }
                const options = {
                    play: false,
                    queue: false,
                    stopPlayback: true,
                    clearQueue: true,
                    positionTo: contextButton
                };
                apiClient.getCurrentUser().then(function (user: any) {
                    contextButton.addEventListener('click', function () {
                        itemContextMenu.show(Object.assign({
                            item: item,
                            user: user
                        }, options))
                            .catch(() => { /* no-op */ });
                    });
                });
            }
            nowPlayingUserData!.innerHTML = '<button is="emby-ratingbutton" type="button" class="mediaButton paper-icon-button-light" data-id="' + item.Id + '" data-serverid="' + item.ServerId + '" data-itemtype="' + item.Type + '" data-likes="' + likes + '" data-isfavorite="' + (userData.IsFavorite) + '"><span class="material-icons favorite" aria-hidden="true"></span></button>';
        });
    } else {
        nowPlayingUserData!.innerHTML = '';
    }
}

function onPlaybackStart(this: any, e: any, state: any): void {
    console.debug('nowplaying event: ' + e.type);
    const player = this;

    onStateChanged.call(player, e, state);
}

function onRepeatModeChange(): void {
    if (!isEnabled) {
        return;
    }

    updateRepeatModeDisplay(playbackManager.getRepeatMode());
}

function onQueueShuffleModeChange(): void {
    if (!isEnabled) {
        return;
    }

    const shuffleMode = playbackManager.getQueueShuffleMode();
    const context = nowPlayingBarElement;
    const cssClass = 'buttonActive';
    if (!context) {
        return;
    }

    const toggleShuffleButton = context.querySelector('.btnShuffleQueue') as HTMLElement | null;
    if (!toggleShuffleButton) {
        return;
    }
    switch (shuffleMode) {
        case 'Shuffle':
            toggleShuffleButton.classList.add(cssClass);
            break;
        case 'Sorted':
        default:
            toggleShuffleButton.classList.remove(cssClass);
            break;
    }
}

function showNowPlayingBar(): void {
    if (!isVisibilityAllowed) {
        hideNowPlayingBar();
        return;
    }

    slideUp(getNowPlayingBar());
}

function hideNowPlayingBar(): void {
    isEnabled = false;

    // Use a timeout to prevent the bar from hiding and showing quickly
    // in the event of a stop->play command

    // Don't call getNowPlayingBar here because we don't want to end up creating it just to hide it
    const elem = document.getElementsByClassName('nowPlayingBar')[0] as HTMLElement | undefined;
    if (elem) {
        slideDown(elem);
    }
}

function onPlaybackStopped(this: any, e: any, state: any): void {
    console.debug('[nowPlayingBar:onPlaybackStopped] event: ' + e.type);

    const player = this;

    if (player.isLocalPlayer) {
        if (state.NextMediaType !== 'Audio') {
            hideNowPlayingBar();
        }
    } else if (!state.NextMediaType) {
        hideNowPlayingBar();
    }
}

function onPlayPauseStateChanged(this: any): void {
    if (!isEnabled) {
        return;
    }

    const player = this as any;
    updatePlayPauseState(player.paused());
}

function onStateChanged(this: any, event: any, state: any): void {
    if (event.type === 'init') {
        // skip non-ready state
        return;
    }

    console.debug('[nowPlayingBar:onStateChanged] event: ' + event.type);
    const player = this;

    if (!state.NowPlayingItem || layoutManager.tv || state.IsFullscreen === false) {
        hideNowPlayingBar();
        return;
    }

    if (player.isLocalPlayer && state.NowPlayingItem && state.NowPlayingItem.MediaType === 'Video') {
        hideNowPlayingBar();
        return;
    }

    isEnabled = true;

    if (nowPlayingBarElement) {
        updatePlayerStateInternal(event, state, player);
        return;
    }

    getNowPlayingBar();
    updateLyricButton(state.NowPlayingItem);
    updatePlayerStateInternal(event, state, player);
}

function onTimeUpdate(this: any): void {
    if (!isEnabled) {
        return;
    }

    // Try to avoid hammering the document with changes
    const now = new Date().getTime();
    if ((now - lastUpdateTime) < 700) {
        return;
    }
    lastUpdateTime = now;

    const player = this;
    currentRuntimeTicks = playbackManager.duration(player);
    updateTimeDisplay(playbackManager.currentTime(player) * 10000, currentRuntimeTicks, playbackManager.getBufferedRanges(player));
}

function releaseCurrentPlayer(): void {
    const player = currentPlayer;

    if (player) {
        Events.off(player, 'playbackstart', onPlaybackStart);
        Events.off(player, 'statechange', onPlaybackStart);
        Events.off(player, 'repeatmodechange', onRepeatModeChange);
        Events.off(player, 'shufflequeuemodechange', onQueueShuffleModeChange);
        Events.off(player, 'playbackstop', onPlaybackStopped);
        Events.off(player, 'volumechange', onVolumeChanged);
        Events.off(player, 'pause', onPlayPauseStateChanged);
        Events.off(player, 'unpause', onPlayPauseStateChanged);
        Events.off(player, 'timeupdate', onTimeUpdate);

        currentPlayer = null;
        hideNowPlayingBar();
    }
}

function onVolumeChanged(this: any): void {
    if (!isEnabled) {
        return;
    }

    const player = this;

    updatePlayerVolumeState(player.isMuted(), player.getVolume());
}

function refreshFromPlayer(player: any, type: string): void {
    const state = playbackManager.getPlayerState(player);

    onStateChanged.call(player, { type }, state);
}

function bindToPlayer(player: any): void {
    isLyricPageActive = isLyricsPage();
    if (player === currentPlayer) {
        return;
    }

    releaseCurrentPlayer();

    currentPlayer = player;

    if (!player) {
        return;
    }

    refreshFromPlayer(player, 'init');

    Events.on(player, 'playbackstart', onPlaybackStart);
    Events.on(player, 'statechange', onPlaybackStart);
    Events.on(player, 'repeatmodechange', onRepeatModeChange);
    Events.on(player, 'shufflequeuemodechange', onQueueShuffleModeChange);
    Events.on(player, 'playbackstop', onPlaybackStopped);
    Events.on(player, 'volumechange', onVolumeChanged);
    Events.on(player, 'pause', onPlayPauseStateChanged);
    Events.on(player, 'unpause', onPlayPauseStateChanged);
    Events.on(player, 'timeupdate', onTimeUpdate);
}

Events.on(playbackManager, 'playerchange', function () {
    bindToPlayer(playbackManager.getCurrentPlayer());
});

bindToPlayer(playbackManager.getCurrentPlayer());

document.addEventListener('viewbeforeshow', function (e: Event) {
    const detail = (e as CustomEvent<{ options?: { enableMediaControl?: boolean } }>).detail;
    isLyricPageActive = isLyricsPage();
    setLyricButtonActiveStatus();
    if (!detail?.options?.enableMediaControl) {
        if (isVisibilityAllowed) {
            isVisibilityAllowed = false;
            hideNowPlayingBar();
        }
    } else if (!isVisibilityAllowed) {
        isVisibilityAllowed = true;
        if (currentPlayer) {
            refreshFromPlayer(currentPlayer, 'refresh');
        } else {
            hideNowPlayingBar();
        }
    }
});

