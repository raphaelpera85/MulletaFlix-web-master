import { playbackManager } from './playbackmanager';
import dom from '../../utils/dom';
import browser from '../../scripts/browser';
import Events from '../../utils/events.ts';

import './iconosd.scss';
import 'material-design-icons-iconfont';

interface BrightnessPlayer {
    brightnesschange: unknown;
    playbackstop: unknown;
}

interface BrightnessPlayerContract {
    isLocalPlayer?: boolean;
}

interface PlaybackManagerContract {
    getBrightness(player: BrightnessPlayerContract): number;
    getCurrentPlayer(): BrightnessPlayerContract | null;
}

let currentPlayer: BrightnessPlayerContract | null;
let osdElement: HTMLDivElement | null;
let iconElement: HTMLElement | null;
let progressElement: HTMLDivElement | null;
let enableAnimation: boolean;
let hideTimeout: number | undefined;

function getOsdElementHtml(): string {
    let html = '';

    html += '<span class="material-icons iconOsdIcon brightness_high" aria-hidden="true"></span>';
    html += '<div class="iconOsdProgressOuter"><div class="iconOsdProgressInner brightnessOsdProgressInner"></div></div>';

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
        elem.classList.add('brightnessOsd');
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

function setIcon(iconHtmlElement: HTMLElement, icon: string): void {
    iconHtmlElement.classList.remove('brightness_high', 'brightness_medium', 'brightness_low');
    iconHtmlElement.classList.add(icon);
}

function updateElementsFromPlayer(brightness: number): void {
    if (iconElement) {
        if (brightness >= 80) {
            setIcon(iconElement, 'brightness_high');
        } else if (brightness >= 20) {
            setIcon(iconElement, 'brightness_medium');
        } else {
            setIcon(iconElement, 'brightness_low');
        }
    }

    if (progressElement) {
        progressElement.style.width = (brightness || 0) + '%';
    }
}

function releaseCurrentPlayer(): void {
    const player = currentPlayer;

    if (player) {
        Events.off(player as BrightnessPlayer, 'brightnesschange', onBrightnessChanged);
        Events.off(player as BrightnessPlayer, 'playbackstop', hideOsd);
        currentPlayer = null;
    }
}

function onBrightnessChanged(this: BrightnessPlayerContract): void {
    const player = this;

    ensureOsdElement();

    updateElementsFromPlayer((playbackManager as unknown as PlaybackManagerContract).getBrightness(player));

    showOsd();
}

function bindToPlayer(player: BrightnessPlayerContract | null): void {
    if (player === currentPlayer) {
        return;
    }

    releaseCurrentPlayer();

    currentPlayer = player;

    if (!player) {
        return;
    }

    hideOsd();
    Events.on(player as BrightnessPlayer, 'brightnesschange', onBrightnessChanged);
    Events.on(player as BrightnessPlayer, 'playbackstop', hideOsd);
}

Events.on(playbackManager, 'playerchange', function () {
    bindToPlayer((playbackManager as unknown as PlaybackManagerContract).getCurrentPlayer());
});

bindToPlayer((playbackManager as unknown as PlaybackManagerContract).getCurrentPlayer());
