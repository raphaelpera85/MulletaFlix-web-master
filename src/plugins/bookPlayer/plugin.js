import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import Screenfull from 'screenfull';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import browser from 'scripts/browser';
import TouchHelper from 'scripts/touchHelper';
import { toApi } from 'utils/jellyfin-apiclient/compat';

import layoutManager from '../../components/layoutManager';
import loading from '../../components/loading/loading';
import keyboardnavigation from '../../scripts/keyboardNavigation';
import dialogHelper from '../../components/dialogHelper/dialogHelper';
import TableOfContents from './tableOfContents';
import { translateHtml } from '../../lib/globalize';
import * as userSettings from '../../scripts/settings/userSettings';
import { PluginType } from '../../types/plugin.ts';
import Events from '../../utils/events.ts';

import 'material-design-icons-iconfont';
import '../../elements/emby-button/paper-icon-button-light';

import html from './template.html';
import './style.scss';

const THEMES = {
    'dark': { 'body': { 'color': '#d8dadc', 'background': '#000', 'font-size': 'medium' } },
    'sepia': { 'body': { 'color': '#d8a262', 'background': '#000', 'font-size': 'medium' } },
    'light': { 'body': { 'color': '#000', 'background': '#fff', 'font-size': 'medium' } }
};
const THEME_ORDER = ['dark', 'sepia', 'light'];
const FONT_SIZES = ['x-small', 'small', 'medium', 'large', 'x-large'];

export class BookPlayer {
    constructor() {
        this.name = 'Book Player';
        this.type = PluginType.MediaPlayer;
        this.id = 'bookplayer';
        this.priority = 1;
        this.THEMES = THEMES;
        if (!userSettings.theme() || userSettings.theme() === 'dark') {
            this.theme = 'dark';
        } else {
            this.theme = 'light';
        }
        this.fontSize = 'medium';
        this.ttsActive = false;
        this.ttsUtterance = null;
        this.ttsPaused = false;
        this.ttsVoices = [];
        this.onDialogClosed = this.onDialogClosed.bind(this);
        this.openTableOfContents = this.openTableOfContents.bind(this);
        this.rotateTheme = this.rotateTheme.bind(this);
        this.increaseFontSize = this.increaseFontSize.bind(this);
        this.decreaseFontSize = this.decreaseFontSize.bind(this);
        this.previous = this.previous.bind(this);
        this.next = this.next.bind(this);
        this.onWindowKeyDown = this.onWindowKeyDown.bind(this);
        this.addSwipeGestures = this.addSwipeGestures.bind(this);
        this.getPlayerHeight = this.getPlayerHeight.bind(this);
        this.toggleFullscreen = this.toggleFullscreen.bind(this);
        this.toggleListen = this.toggleListen.bind(this);
        this.speakCurrentPage = this.speakCurrentPage.bind(this);
        this.stopSpeech = this.stopSpeech.bind(this);
        this.toggleTtsPlayPause = this.toggleTtsPlayPause.bind(this);
        this.populateVoices = this.populateVoices.bind(this);
        this.onVoicesChanged = this.onVoicesChanged.bind(this);
        this.onTtsEnd = this.onTtsEnd.bind(this);
        this.startReading = this.startReading.bind(this);
        this.setCurrentPageAsCover = this.setCurrentPageAsCover.bind(this);
        this.fullscreen = false;

        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.addEventListener('voiceschanged', this.onVoicesChanged);
            this.populateVoices();
        }
    }

    play(options) {
        this.progress = 0;
        this.cancellationToken = false;
        this.loaded = false;

        loading.show();
        const elem = this.createMediaElement();
        return this.setCurrentSrc(elem, options);
    }

    stop() {
        this.stopSpeech();
        this.unbindEvents();

        const stopInfo = {
            src: this.item
        };

        Events.trigger(this, 'stopped', [stopInfo]);

        const elem = this.mediaElement;
        const tocElement = this.tocElement;
        const rendition = this.rendition;

        if (elem) {
            dialogHelper.close(elem);
            this.mediaElement = null;
        }

        if (tocElement) {
            tocElement.destroy();
            this.tocElement = null;
        }

        if (rendition) {
            rendition.destroy();
        }

        if (this.fullscreen) {
            this.toggleFullscreen();
        }

        // hide loader in case player was not fully loaded yet
        loading.hide();
        this.cancellationToken = true;
    }

    destroy() {
        this.stopSpeech();
        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.removeEventListener('voiceschanged', this.onVoicesChanged);
        }
    }

    currentItem() {
        return this.item;
    }

    currentTime() {
        return this.progress * 1000;
    }

    duration() {
        return 1000;
    }

    getBufferedRanges() {
        return [{
            start: 0,
            end: 10000000
        }];
    }

    volume() {
        return 100;
    }

    isMuted() {
        return false;
    }

    paused() {
        return false;
    }

    seekable() {
        return true;
    }

    onWindowKeyDown(e) {
        // Skip modified keys
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        const key = keyboardnavigation.getKeyName(e);

        if (!this.loaded) return;
        switch (key) {
            case 'KeyL':
            case 'ArrowRight':
            case 'Right':
                e.preventDefault();
                this.next();
                break;
            case 'KeyJ':
            case 'ArrowLeft':
            case 'Left':
                e.preventDefault();
                this.previous();
                break;
            case 'Escape':
                e.preventDefault();
                if (this.tocElement) {
                    // Close table of contents on ESC if it is open
                    this.tocElement.destroy();
                } else {
                    // Otherwise stop the entire book player
                    this.stop();
                }
                break;
        }
    }

    addSwipeGestures(element) {
        this.touchHelper = new TouchHelper(element);
        Events.on(this.touchHelper, 'swipeleft', () => this.next());
        Events.on(this.touchHelper, 'swiperight', () => this.previous());
    }

    onDialogClosed() {
        this.stop();
    }

    bindMediaElementEvents() {
        const elem = this.mediaElement;

        elem.addEventListener('close', this.onDialogClosed, { once: true });
        elem.querySelector('#btnBookplayerExit').addEventListener('click', this.onDialogClosed, { once: true });
        elem.querySelector('#btnBookplayerToc').addEventListener('click', this.openTableOfContents);
        elem.querySelector('#btnBookplayerFullscreen').addEventListener('click', this.toggleFullscreen);
        elem.querySelector('#btnBookplayerRotateTheme').addEventListener('click', this.rotateTheme);
        elem.querySelector('#btnBookplayerIncreaseFontSize').addEventListener('click', this.increaseFontSize);
        elem.querySelector('#btnBookplayerDecreaseFontSize').addEventListener('click', this.decreaseFontSize);
        elem.querySelector('#btnBookplayerPrev')?.addEventListener('click', this.previous);
        elem.querySelector('#btnBookplayerNext')?.addEventListener('click', this.next);
        elem.querySelector('#btnBookplayerListen')?.addEventListener('click', this.toggleListen);
        elem.querySelector('#btnTtsPlayPause')?.addEventListener('click', this.toggleTtsPlayPause);
        elem.querySelector('#btnTtsStop')?.addEventListener('click', this.stopSpeech);
        elem.querySelector('#ttsLangSelect')?.addEventListener('change', this.populateVoices);
        elem.querySelector('#ttsSpeedSelect')?.addEventListener('change', () => {
            if (this.ttsActive) this.speakCurrentPage();
        });
        elem.querySelector('#ttsVoiceSelect')?.addEventListener('change', () => {
            if (this.ttsActive) this.speakCurrentPage();
        });
    }

    bindEvents() {
        this.bindMediaElementEvents();

        document.addEventListener('keydown', this.onWindowKeyDown);
        this.rendition?.on('keydown', this.onWindowKeyDown);

        if (browser.safari) {
            const player = document.getElementById('bookPlayerContainer');
            this.addSwipeGestures(player);
        } else {
            this.rendition?.on('rendered', (e, i) => this.addSwipeGestures(i.document.documentElement));
        }
    }

    unbindMediaElementEvents() {
        const elem = this.mediaElement;

        elem.removeEventListener('close', this.onDialogClosed);
        elem.querySelector('#btnBookplayerExit').removeEventListener('click', this.onDialogClosed);
        elem.querySelector('#btnBookplayerToc').removeEventListener('click', this.openTableOfContents);
        elem.querySelector('#btnBookplayerFullscreen').removeEventListener('click', this.toggleFullscreen);
        elem.querySelector('#btnBookplayerRotateTheme').removeEventListener('click', this.rotateTheme);
        elem.querySelector('#btnBookplayerIncreaseFontSize').removeEventListener('click', this.increaseFontSize);
        elem.querySelector('#btnBookplayerDecreaseFontSize').removeEventListener('click', this.decreaseFontSize);
        elem.querySelector('#btnBookplayerPrev')?.removeEventListener('click', this.previous);
        elem.querySelector('#btnBookplayerNext')?.removeEventListener('click', this.next);
        elem.querySelector('#btnBookplayerListen')?.removeEventListener('click', this.toggleListen);
        elem.querySelector('#btnTtsPlayPause')?.removeEventListener('click', this.toggleTtsPlayPause);
        elem.querySelector('#btnTtsStop')?.removeEventListener('click', this.stopSpeech);
    }

    unbindEvents() {
        if (this.mediaElement) {
            this.unbindMediaElementEvents();
        }

        document.removeEventListener('keydown', this.onWindowKeyDown);
        this.rendition?.off('keydown', this.onWindowKeyDown);

        if (!browser.safari) {
            this.rendition?.off('rendered', (e, i) => this.addSwipeGestures(i.document.documentElement));
        }

        this.touchHelper?.destroy();
    }

    getPlayerHeight() {
        if (layoutManager.mobile) {
            // we have no method from NativeShell to get the required margin for mobile devices
            return this.fullscreen ? 0.9 : 0.94;
        }

        // desktop needs slightly less space than mobile
        return 0.958;
    }

    openTableOfContents() {
        if (this.loaded) {
            this.tocElement = new TableOfContents(this);
        }
    }

    toggleFullscreen() {
        const icon = document.querySelector('#btnBookplayerFullscreen .material-icons');
        const buttons = document.querySelector('.topButtons');

        if (Screenfull.isEnabled) {
            icon.classList.remove(Screenfull.isFullscreen ? 'fullscreen_exit' : 'fullscreen');
            icon.classList.add(Screenfull.isFullscreen ? 'fullscreen' : 'fullscreen_exit');
            Screenfull.toggle();
        } else if (window.NativeShell) {
            if (this.fullscreen) {
                icon.classList.remove('fullscreen_exit');
                icon.classList.add('fullscreen');
                buttons.classList.remove('fullscreen');
                window.NativeShell.disableFullscreen();
            } else {
                icon.classList.remove('fullscreen');
                icon.classList.add('fullscreen_exit');
                buttons.classList.add('fullscreen');
                window.NativeShell.enableFullscreen();
            }
        }

        // needs to be executed with a slight delay to give NativeShell time to process the request
        setTimeout(() => this.rendition.resize(document.body.clientWidth, document.body.clientHeight * this.getPlayerHeight()), 200);

        // required for mobile apps without browser fullscreen support
        this.fullscreen = !this.fullscreen;
    }

    rotateTheme() {
        if (this.loaded) {
            const newTheme = THEME_ORDER[(THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length];
            this.rendition.themes.register('default', THEMES[newTheme]);
            this.rendition.themes.update('default');
            this.theme = newTheme;
        }
    }

    increaseFontSize() {
        if (this.loaded && this.fontSize !== FONT_SIZES[FONT_SIZES.length - 1]) {
            const newFontSize = FONT_SIZES[(FONT_SIZES.indexOf(this.fontSize) + 1)];
            this.rendition.themes.fontSize(newFontSize);
            this.fontSize = newFontSize;
        }
    }

    decreaseFontSize() {
        if (this.loaded && this.fontSize !== FONT_SIZES[0]) {
            const newFontSize = FONT_SIZES[(FONT_SIZES.indexOf(this.fontSize) - 1)];
            this.rendition.themes.fontSize(newFontSize);
            this.fontSize = newFontSize;
        }
    }

    previous(e) {
        e?.preventDefault();
        if (this.rendition) {
            this.rendition.book.package.metadata.direction === 'rtl' ? this.rendition.next() : this.rendition.prev();
        }
    }

    next(e) {
        e?.preventDefault();
        if (this.rendition) {
            this.rendition.book.package.metadata.direction === 'rtl' ? this.rendition.prev() : this.rendition.next();
        }
    }

    onVoicesChanged() {
        this.populateVoices();
    }

    populateVoices() {
        if (typeof speechSynthesis === 'undefined') return;
        this.ttsVoices = speechSynthesis.getVoices();
        const select = document.getElementById('ttsVoiceSelect');
        const langSelect = document.getElementById('ttsLangSelect');
        if (!select) return;
        const currentVal = select.value;
        const selectedLang = langSelect ? langSelect.value : '';
        select.innerHTML = '';
        this.ttsVoices.forEach(function (voice) {
            if (selectedLang && !voice.lang.startsWith(selectedLang)) return;
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = voice.name + ' (' + voice.lang + ')';
            select.appendChild(option);
        });
        if (currentVal && select.querySelector('option[value="' + currentVal + '"]')) {
            select.value = currentVal;
        }
    }

    extractTextFromPage() {
        if (!this.rendition) return '';
        const body = this.rendition.getContents()[0]?.document?.body;
        if (!body) return '';
        return body.textContent || '';
    }

    toggleListen() {
        if (typeof speechSynthesis === 'undefined') {
            console.warn('SpeechSynthesis not available');
            return;
        }
        const panel = document.getElementById('bookplayerTtsPanel');
        const icon = document.querySelector('#btnBookplayerListen .material-icons');
        if (!panel) return;

        if (this.ttsActive) {
            this.stopSpeech();
            panel.classList.add('hide');
            if (icon) icon.textContent = 'volume_up';
            this.ttsActive = false;
        } else {
            panel.classList.remove('hide');
            if (icon) icon.textContent = 'volume_off';
            this.ttsActive = true;
            this.populateVoices();
            this.speakCurrentPage();
        }
    }

    speakCurrentPage() {
        if (typeof speechSynthesis === 'undefined' || !this.ttsActive) return;

        speechSynthesis.cancel();
        const text = this.extractTextFromPage();
        if (!text) return;

        const utterance = new SpeechSynthesisUtterance(text);
        const voiceSelect = document.getElementById('ttsVoiceSelect');
        const speedSelect = document.getElementById('ttsSpeedSelect');

        if (voiceSelect && voiceSelect.value) {
            const selectedVoice = this.ttsVoices.find(function (v) { return v.name === voiceSelect.value; });
            if (selectedVoice) utterance.voice = selectedVoice;
        }

        if (speedSelect) {
            utterance.rate = parseFloat(speedSelect.value);
        }

        utterance.onend = this.onTtsEnd;
        utterance.onerror = this.onTtsEnd;

        this.ttsUtterance = utterance;
        this.ttsPaused = false;

        const playPauseIcon = document.querySelector('#btnTtsPlayPause .material-icons');
        if (playPauseIcon) playPauseIcon.textContent = 'pause';

        speechSynthesis.speak(utterance);
    }

    toggleTtsPlayPause() {
        if (!this.ttsUtterance) {
            this.speakCurrentPage();
            return;
        }
        const icon = document.querySelector('#btnTtsPlayPause .material-icons');
        if (this.ttsPaused) {
            speechSynthesis.resume();
            this.ttsPaused = false;
            if (icon) icon.textContent = 'pause';
        } else {
            speechSynthesis.pause();
            this.ttsPaused = true;
            if (icon) icon.textContent = 'play_arrow';
        }
    }

    stopSpeech() {
        if (typeof speechSynthesis === 'undefined') return;
        speechSynthesis.cancel();
        this.ttsUtterance = null;
        this.ttsPaused = false;
        const playPauseIcon = document.querySelector('#btnTtsPlayPause .material-icons');
        if (playPauseIcon) playPauseIcon.textContent = 'play_arrow';
    }

    onTtsEnd() {
        this.ttsUtterance = null;
        this.ttsPaused = false;
        const playPauseIcon = document.querySelector('#btnTtsPlayPause .material-icons');
        if (playPauseIcon) playPauseIcon.textContent = 'play_arrow';
    }

    showCover(contentWindow) {
        const cover = document.getElementById('bookPlayerCover');
        const coverPage = document.getElementById('bookPlayerCoverPage');
        if (!cover || !coverPage) return;

        const body = contentWindow?.document?.body;
        if (!body) {
            cover.classList.add('hide');
            return;
        }

        coverPage.innerHTML = body.innerHTML;
        cover.classList.remove('hide');

        const coverBtn = document.getElementById('btnCoverStartReading');
        const setCoverBtn = document.getElementById('btnCoverSetAsCover');
        if (coverBtn) coverBtn.addEventListener('click', this.startReading, { once: true });
        if (setCoverBtn) setCoverBtn.addEventListener('click', this.setCurrentPageAsCover, { once: true });
    }

    startReading() {
        const cover = document.getElementById('bookPlayerCover');
        if (cover) cover.classList.add('hide');
        const epubElem = document.querySelector('.epub-container');
        if (epubElem) epubElem.style.opacity = '';
    }

    async setCurrentPageAsCover() {
        const item = this.item;
        if (!item || !item.Id) return;

        try {
            const content = this.rendition?.getContents()[0];
            if (!content) return;

            const doc = content.document;
            const pageContent = doc?.body?.innerHTML;
            if (!pageContent) return;

            const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">'
                + '<defs><style>body{color:#000;background:#fff;font-family:serif;padding:40px;font-size:18px;line-height:1.6;margin:0}*{max-width:100%;}</style></defs>'
                + '<foreignObject width="100%" height="100%">'
                + '<div xmlns="http://www.w3.org/1999/xhtml">' + pageContent + '</div>'
                + '</foreignObject></svg>';

            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = 600;
                canvas.height = 800;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, 600, 800);
                ctx.drawImage(img, 0, 0, 600, 800);
                URL.revokeObjectURL(url);

                canvas.toBlob(function (pngBlob) {
                    if (!pngBlob) return;
                    const file = new File([pngBlob], 'cover.png', { type: 'image/png' });
                    ServerConnections.getApiClient(item.ServerId)
                        .uploadItemImage(item.Id, 0 /* ImageType.Primary */, file)
                        .then(function () {
                            const btn = document.getElementById('btnCoverSetAsCover');
                            if (btn) btn.textContent = '✓ Capa salva!';
                        })
                        .catch(function (err) {
                            console.error('Failed to upload cover:', err);
                        });
                }, 'image/png');
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                console.error('Failed to render cover SVG');
            };
            img.src = url;
        } catch (err) {
            console.error('Failed to capture cover:', err);
        }
    }

    createMediaElement() {
        let elem = this.mediaElement;
        if (elem) {
            return elem;
        }

        elem = document.getElementById('bookPlayer');
        if (!elem) {
            elem = dialogHelper.createDialog({
                exitAnimationDuration: 400,
                size: 'fullscreen',
                autoFocus: false,
                scrollY: false,
                exitAnimation: 'fadeout',
                removeOnClose: true
            });

            elem.id = 'bookPlayer';
            elem.innerHTML = translateHtml(html);

            dialogHelper.open(elem);
        }

        this.mediaElement = elem;
        return elem;
    }

    setCurrentSrc(elem, options) {
        const item = options.items[0];
        this.item = item;
        this.streamInfo = {
            started: true,
            ended: false,
            item: this.item,
            mediaSource: {
                Id: item.Id
            }
        };

        if (!Screenfull.isEnabled) {
            document.getElementById('btnBookplayerFullscreen').display = 'none';
        }

        return new Promise((resolve, reject) => {
            import('epubjs').then(({ default: epubjs }) => {
                const api = toApi(ServerConnections.getApiClient(item));
                const downloadHref = getLibraryApi(api).getDownloadUrl({ itemId: item.Id });
                const book = epubjs(downloadHref, { openAs: 'epub' });

                const rendition = book.renderTo('bookPlayerContainer', {
                    width: '100%',
                    height: document.body.clientHeight * this.getPlayerHeight(),
                    // TODO: Add option for scrolled-doc
                    flow: 'paginated'
                });

                this.currentSrc = downloadHref;
                this.rendition = rendition;

                rendition.themes.register('default', THEMES[this.theme]);
                rendition.themes.select('default');

                return rendition.display().then(() => {
                    const epubElem = document.querySelector('.epub-container');
                    epubElem.style.opacity = '0';

                    this.bindEvents();

                    return this.rendition.book.locations.generate(1024).then(async () => {
                        if (this.cancellationToken) reject();

                        const percentageTicks = options.startPositionTicks / 10000000;
                        if (percentageTicks !== 0.0) {
                            const resumeLocation = book.locations.cfiFromPercentage(percentageTicks);
                            await rendition.display(resumeLocation);
                        }

                        this.loaded = true;
                        rendition.on('relocated', (locations) => {
                            this.progress = book.locations.percentageFromCfi(locations.start.cfi);
                            Events.trigger(this, 'pause');
                            if (this.ttsActive) {
                                this.speakCurrentPage();
                            }
                        });

                        const contents = rendition.getContents();
                        if (contents.length && !percentageTicks) {
                            setTimeout(() => {
                                this.showCover(contents[0].window);
                            }, 100);
                        } else {
                            epubElem.style.opacity = '';
                        }

                        loading.hide();
                        return resolve();
                    });
                }, () => {
                    console.error('failed to display epub');
                    return reject();
                });
            });
        });
    }

    canPlayMediaType(mediaType) {
        return (mediaType || '').toLowerCase() === 'book';
    }

    canPlayItem(item) {
        return item.Path?.endsWith('epub');
    }
}

export default BookPlayer;

