import { playbackManager } from './playbackmanager';
import dom from '../../utils/dom';
import browser from '../../scripts/browser';
import Events from '../../utils/events.ts';

import './iconosd.scss';
import 'material-design-icons-iconfont';

interface VolumePlayer {
    volumechange: unknown;
    playbackstop: unknown;
}

interface VolumePlayerContract {
    isMuted(): boolean;
    getVolume(): number;
}

interface PlaybackManagerContract {
    getCurrentPlayer(): VolumePlayerContract | null;
}

let currentPlayer: VolumePlayerContract | null;
let osdElement: HTMLDivElement | null;
let iconElement: HTMLElement | null;
let progressElement: HTMLDivElement | null;
let enableAnimation: boolean;
let hideTimeout: number | undefined;

function getOsdElementHtml(): string {
    let html = '';

    html += '<span class="material-icons iconOsdIcon volume_up" aria-hidden="true"></span>';
    html += '<div class="iconOsdProgressOuter"><div class="iconOsdProgressInner"></div></div>';

    return html;
}

function ensureOsdElement(): void {
    let elem = osdElement;
    if (!elem) {
        enableAnimation = browser.supportsCssAnimation();

        elem = document.createElement('div');
        elem.classList.add('hide');
        elem.classList.add('iconOsd');
        elem.classList.add('iconOsd-hidden');
        elem.classList.add('volumeOsd');
        elem.innerHTML = getOsdElementHtml();

        iconElement = elem.querySelector('.material-icons');
        progressElement = elem.querySelector('.iconOsdProgressInner');

        document.body.appendChild(elem);
        osdElement = elem;
    }
}

function onHideComplete(this: HTMLElement): void {
    this.classList.add('hide');
}

function clearHideTimeout(): void {
    if (hideTimeout !== undefined) {
        clearTimeout(hideTimeout);
        hideTimeout = undefined;
    }
}

function showOsd(): void {
    clearHideTimeout();

    const elem = osdElement;
    if (!elem) {
        return;
    }

    dom.removeEventListener(elem, dom.whichTransitionEvent(), onHideComplete, {
        once: true
    });

    elem.classList.remove('hide');
    void elem.offsetWidth;

    requestAnimationFrame(function () {
        elem.classList.remove('iconOsd-hidden');

        hideTimeout = window.setTimeout(hideOsd, 3000);
    });
}

function hideOsd(): void {
    clearHideTimeout();

    const elem = osdElement;
    if (elem) {
        if (enableAnimation) {
            void elem.offsetWidth;

            requestAnimationFrame(function () {
                elem.classList.add('iconOsd-hidden');

                dom.addEventListener(elem, dom.whichTransitionEvent(), onHideComplete, {
                    once: true
                });
            });
        } else {
            onHideComplete.call(elem);
        }
    }
}

function updatePlayerVolumeState(isMuted: boolean, volume: number): void {
    if (iconElement) {
        iconElement.classList.remove('volume_off', 'volume_up');
        iconElement.classList.add(isMuted ? 'volume_off' : 'volume_up');
    }

    if (progressElement) {
        progressElement.style.width = (volume || 0) + '%';
    }
}

function releaseCurrentPlayer(): void {
    const player = currentPlayer;

    if (player) {
        Events.off(player as unknown as VolumePlayer, 'volumechange', onVolumeChanged);
        Events.off(player as unknown as VolumePlayer, 'playbackstop', hideOsd);
        currentPlayer = null;
    }
}

function onVolumeChanged(this: VolumePlayerContract): void {
    const player = this;

    ensureOsdElement();

    updatePlayerVolumeState(player.isMuted(), player.getVolume());

    showOsd();
}

function bindToPlayer(player: VolumePlayerContract | null): void {
    if (player === currentPlayer) {
        return;
    }

    releaseCurrentPlayer();

    currentPlayer = player;

    if (!player) {
        return;
    }

    hideOsd();
    Events.on(player as unknown as VolumePlayer, 'volumechange', onVolumeChanged);
    Events.on(player as unknown as VolumePlayer, 'playbackstop', hideOsd);
}

Events.on(playbackManager, 'playerchange', function () {
    bindToPlayer((playbackManager as unknown as PlaybackManagerContract).getCurrentPlayer());
});

bindToPlayer((playbackManager as unknown as PlaybackManagerContract).getCurrentPlayer());
