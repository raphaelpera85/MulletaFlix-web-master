import dom from '../../utils/dom';
import { playbackManager } from '../playback/playbackmanager';
import Events from '../../utils/events';
import mediaInfo from '../mediainfo/mediainfo';
import layoutManager from '../layoutManager';
import focusManager from '../focusManager';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import itemHelper from '../itemHelper';

import './upnextdialog.scss';
import '../../elements/emby-button/emby-button';
import '../../styles/flexstyles.scss';

interface UpNextDialogOptions {
    parent: HTMLElement;
    nextItem: NextItem;
    player: unknown;
    [key: string]: unknown;
}

interface NextItem {
    ServerId?: string;
    Type?: string;
    SeriesName?: string;
    Id?: string;
    [key: string]: unknown;
}

interface UserConfiguration {
    EnableNextEpisodeAutoPlay?: boolean;
    [key: string]: unknown;
}

interface CurrentUser {
    Configuration: UserConfiguration;
    [key: string]: unknown;
}

const transitionEndEventName = dom.whichTransitionEvent() || 'transitionend';

function getHtml(): string {
    let html = '';

    html += '<div class="flex flex-direction-column flex-grow">';

    html += '<h2 class="upNextDialog-nextVideoText" style="margin:.25em 0;">&nbsp;</h2>';

    html += '<h3 class="upNextDialog-title" style="margin:.25em 0 .5em;"></h3>';

    html += '<div class="flex flex-direction-row upNextDialog-mediainfo">';
    html += '</div>';

    html += '<div class="flex flex-direction-row upNextDialog-buttons" style="margin-top:1em;">';

    html += '<button type="button" is="emby-button" class="raised raised-mini btnStartNow upNextDialog-button">';
    html += globalize.translate('HeaderStartNow');
    html += '</button>';

    html += '<button type="button" is="emby-button" class="raised raised-mini btnHide upNextDialog-button">';
    html += globalize.translate('Hide');
    html += '</button>';

    // buttons
    html += '</div>';

    // main
    html += '</div>';

    return html;
}

function setNextVideoText(this: UpNextDialog): void {
    const instance = this;

    const elem = instance.options.parent;

    const secondsRemaining = Math.max(Math.round(getTimeRemainingMs(instance) / 1000), 0);

    console.debug('up next seconds remaining: ' + secondsRemaining);

    const timeText = '<span class="upNextDialog-countdownText">' + globalize.translate('HeaderSecondsValue', String(secondsRemaining)) + '</span>';

    let nextVideoText: string;
    if (instance.itemType === 'Episode') {
        nextVideoText = instance.showStaticNextText ?
            globalize.translate('HeaderNextEpisode') :
            globalize.translate('HeaderNextEpisodePlayingInValue', timeText);
    } else {
        nextVideoText = instance.showStaticNextText ?
            globalize.translate('HeaderNextVideo') :
            globalize.translate('HeaderNextVideoPlayingInValue', timeText);
    }

    elem.querySelector('.upNextDialog-nextVideoText')!.innerHTML = nextVideoText;
}

function fillItem(this: UpNextDialog, item: NextItem): void {
    const instance = this;

    const elem = instance.options.parent;

    elem.querySelector('.upNextDialog-mediainfo')!.innerHTML = mediaInfo.getPrimaryMediaInfoHtml(item, {
        criticRating: true,
        originalAirDate: false,
        starRating: true,
        subtitles: false
    });

    let title = itemHelper.getDisplayName(item);
    if (item.SeriesName) {
        title = item.SeriesName + ' - ' + title;
    }

    (elem.querySelector('.upNextDialog-title') as HTMLElement).innerText = title || '';

    instance.itemType = item.Type;

    instance.show();
}

function clearCountdownTextTimeout(instance: UpNextDialog): void {
    if (instance._countdownTextTimeout) {
        clearInterval(instance._countdownTextTimeout);
        instance._countdownTextTimeout = null;
    }
}

async function onStartNowClick(this: UpNextDialog): Promise<void> {
    const options = this.options;

    if (options) {
        const player = options.player;

        await this.hide();

        playbackManager.nextTrack(player);
    }
}

async function init(instance: UpNextDialog, options: UpNextDialogOptions): Promise<void> {
    instance.showStaticNextText = await showStaticNextText(options.nextItem);

    options.parent.innerHTML = getHtml();

    options.parent.classList.add('hide');
    options.parent.classList.add('upNextDialog');
    options.parent.classList.add('upNextDialog-hidden');

    fillItem.call(instance, options.nextItem);

    options.parent.querySelector('.btnHide')?.addEventListener('click', instance.hide.bind(instance));
    options.parent.querySelector('.btnStartNow')?.addEventListener('click', onStartNowClick.bind(instance));
}

function clearHideAnimationEventListeners(instance: UpNextDialog, elem: HTMLElement): void {
    const fn = instance._onHideAnimationComplete;

    if (fn) {
        elem.removeEventListener(transitionEndEventName, fn as EventListener);
    }
}

function onHideAnimationComplete(this: UpNextDialog, e: Event): void {
    const instance = this;
    const elem = e.target as HTMLElement;

    elem.classList.add('hide');

    clearHideAnimationEventListeners(instance, elem);
    Events.trigger(instance, 'hide');
}

async function hideComingUpNext(this: UpNextDialog): Promise<void> {
    const instance = this;
    clearCountdownTextTimeout(this);

    if (!instance.options) {
        return;
    }

    const elem = instance.options.parent;

    if (!elem) {
        return;
    }

    clearHideAnimationEventListeners(this, elem);

    if (elem.classList.contains('upNextDialog-hidden')) {
        return;
    }

    const fn = onHideAnimationComplete.bind(instance);
    instance._onHideAnimationComplete = fn;

    const transitionEvent = await new Promise<Event>((resolve) => {
        elem.addEventListener(transitionEndEventName, (event) => resolve(event), {
            once: true
        });

        // trigger a reflow to force it to animate again
        void elem.offsetWidth;

        elem.classList.add('upNextDialog-hidden');
    });

    instance._onHideAnimationComplete(transitionEvent);
}

function getTimeRemainingMs(instance: UpNextDialog): number {
    const options = instance.options;
    if (options) {
        const runtimeTicks = playbackManager.duration(options.player);

        if (runtimeTicks) {
            const timeRemainingTicks = runtimeTicks - playbackManager.currentTime(options.player) * 10000;

            return Math.round(timeRemainingTicks / 10000);
        }
    }

    return 0;
}

function startComingUpNextHideTimer(instance: UpNextDialog): void {
    const timeRemainingMs = getTimeRemainingMs(instance);

    if (timeRemainingMs <= 0) {
        return;
    }

    setNextVideoText.call(instance);
    clearCountdownTextTimeout(instance);

    if (!instance.showStaticNextText) instance._countdownTextTimeout = setInterval(setNextVideoText.bind(instance), 400);
}

async function showStaticNextText(nextItem: NextItem): Promise<boolean> {
    const apiClient = ServerConnections.getApiClient(nextItem);
    const currentUser = await apiClient.getCurrentUser() as unknown as CurrentUser;
    return !currentUser.Configuration.EnableNextEpisodeAutoPlay;
}

class UpNextDialog {
    options: UpNextDialogOptions;
    showStaticNextText: boolean;
    itemType: string | undefined;
    _countdownTextTimeout: ReturnType<typeof setInterval> | null = null;
    _onHideAnimationComplete: ((e: Event) => void) | null = null;

    constructor(options: UpNextDialogOptions) {
        this.options = options;
        this.showStaticNextText = false; // default to showing countdown text

        init(this, options);
    }

    show(): void {
        const elem = this.options.parent;

        clearHideAnimationEventListeners(this, elem);

        elem.classList.remove('hide');

        // trigger a reflow to force it to animate again
        void elem.offsetWidth;

        elem.classList.remove('upNextDialog-hidden');

        if (layoutManager.tv) {
            setTimeout(function () {
                focusManager.focus(elem.querySelector('.btnStartNow'));
            }, 50);
        }

        startComingUpNextHideTimer(this);
    }

    async hide(): Promise<void> {
        await hideComingUpNext.bind(this)();
    }

    destroy(): void {
        hideComingUpNext.call(this);

        this.options = null!;
        this.showStaticNextText = false;
        this.itemType = null!;
    }
}

export default UpNextDialog;
