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

interface ThemeStyles {
    body: {
        color: string;
        background: string;
        'font-size': string;
    };
}

type ThemeName = 'dark' | 'sepia' | 'light';

const THEMES: Record<ThemeName, ThemeStyles> = {
    'dark': { 'body': { 'color': '#d8dadc', 'background': '#000', 'font-size': 'medium' } },
    'sepia': { 'body': { 'color': '#d8a262', 'background': '#000', 'font-size': 'medium' } },
    'light': { 'body': { 'color': '#000', 'background': '#fff', 'font-size': 'medium' } }
};
const THEME_ORDER: ThemeName[] = ['dark', 'sepia', 'light'];
const FONT_SIZES = ['x-small', 'small', 'medium', 'large', 'x-large'] as const;
type FontSize = typeof FONT_SIZES[number];
const BOOK_EXTENSIONS = new Set(['.epub', '.mobi', '.azw', '.azw3', '.txt', '.html', '.htm']);
let autoChapterId = 0;
const CHAPTER_HEADING_SELECTORS = [
    'h1',
    'h2',
    'h3',
    '[role="doc-chapter"]',
    '[type~="chapter"]',
    '.chapter',
    '.capitulo',
    '.capítulo',
    '.chapter-title',
    '.titulo',
    '.title'
];
const CHAPTER_LABEL_REGEX = /^(chapter|cap[ií]tulo|cap\.|parte|part|livro|book)\s+([0-9ivxlcdm]+|[a-z])/i;
const MATERIAL_ICON_CLASSES = [
    'volume_up',
    'volume_off',
    'play_arrow',
    'pause'
];

function setMaterialIcon(icon: Element | null | undefined, iconName: string): void {
    if (!icon) return;

    icon.classList.remove(...MATERIAL_ICON_CLASSES);
    icon.classList.add(iconName);
    icon.textContent = '';
}

interface Chapter {
    href: string;
    label: string;
    depth: number;
    source: string;
}

interface PlayOptions {
    items: Array<{ Id?: string; ServerId?: string; Path?: string; Name?: string; ImageTags?: { Primary?: string } }>;
    startPositionTicks?: number;
}

interface BookUploadApiClient {
    uploadItemImage(itemId: string | undefined, index: number, file: File): Promise<unknown>;
}

export class BookPlayer {
    name: string;
    type: PluginType;
    id: string;
    priority: number;
    THEMES: Record<ThemeName, ThemeStyles>;
    theme: ThemeName;
    fontSize: FontSize;
    ttsActive: boolean;
    ttsUtterance: SpeechSynthesisUtterance | null;
    ttsPaused: boolean;
    ttsVoices: SpeechSynthesisVoice[];
    ttsRequestId: number;
    chapterMap: Chapter[];
    chapterMapReady: boolean;
    fullscreen: boolean;
    progress!: number;
    cancellationToken!: boolean;
    loaded!: boolean;
    mediaElement: HTMLElement | null = null;
    tocElement: TableOfContents | null = null;
    rendition: any;
    epubjs: any;
    currentSrc: string = '';
    touchHelper: TouchHelper | null = null;
    item: any;
    streamInfo: any;

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
        this.ttsRequestId = 0;
        this.chapterMap = [];
        this.chapterMapReady = false;
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
        this.fullscreen = false;

        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.addEventListener('voiceschanged', this.onVoicesChanged);
            this.populateVoices();
        }
    }

    play(options: PlayOptions): Promise<void> {
        this.progress = 0;
        this.cancellationToken = false;
        this.loaded = false;

        loading.show();
        const elem = this.createMediaElement();
        return this.setCurrentSrc(elem, options);
    }

    stop(): void {
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

    destroy(): void {
        this.stopSpeech();
        if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.removeEventListener('voiceschanged', this.onVoicesChanged);
        }
    }

    currentItem(): any {
        return this.item;
    }

    currentTime(): number {
        return this.progress * 1000;
    }

    duration(): number {
        return 1000;
    }

    getBufferedRanges(): Array<{ start: number; end: number }> {
        return [{
            start: 0,
            end: 10000000
        }];
    }

    volume(): number {
        return 100;
    }

    isMuted(): boolean {
        return false;
    }

    paused(): boolean {
        return false;
    }

    seekable(): boolean {
        return true;
    }

    onWindowKeyDown(e: KeyboardEvent): void {
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

    addSwipeGestures(element: HTMLElement): void {
        this.touchHelper = new TouchHelper(element);
        Events.on(this.touchHelper, 'swipeleft', () => this.next());
        Events.on(this.touchHelper, 'swiperight', () => this.previous());
    }

    onDialogClosed(): void {
        this.stop();
    }

    bindMediaElementEvents(): void {
        const elem = this.mediaElement!;

        elem.addEventListener('close', this.onDialogClosed, { once: true });
        elem.querySelector('#btnBookplayerExit')!.addEventListener('click', this.onDialogClosed, { once: true });
        elem.querySelector('#btnBookplayerToc')!.addEventListener('click', this.openTableOfContents);
        elem.querySelector('#btnBookplayerFullscreen')!.addEventListener('click', this.toggleFullscreen);
        elem.querySelector('#btnBookplayerRotateTheme')!.addEventListener('click', this.rotateTheme);
        elem.querySelector('#btnBookplayerIncreaseFontSize')!.addEventListener('click', this.increaseFontSize);
        elem.querySelector('#btnBookplayerDecreaseFontSize')!.addEventListener('click', this.decreaseFontSize);
        elem.querySelector('#btnBookplayerPrev')?.addEventListener('click', this.previous);
        elem.querySelector('#btnBookplayerNext')?.addEventListener('click', this.next);
        elem.querySelector('#btnBookplayerListen')?.addEventListener('click', this.toggleListen);
        elem.querySelector('#btnTtsPlayPause')?.addEventListener('click', this.toggleTtsPlayPause);
        elem.querySelector('#btnTtsStop')?.addEventListener('click', this.stopSpeech);
        elem.querySelector('#ttsLangSelect')?.addEventListener('change', this.populateVoices);
        elem.querySelector('#ttsSpeedSelect')?.addEventListener('change', () => {
            if (this.ttsActive) void this.speakCurrentPage();
        });
        elem.querySelector('#ttsVoiceSelect')?.addEventListener('change', () => {
            if (this.ttsActive) void this.speakCurrentPage();
        });
    }

    bindEvents(): void {
        this.bindMediaElementEvents();

        document.addEventListener('keydown', this.onWindowKeyDown);
        this.rendition?.on('keydown', this.onWindowKeyDown);

        if (browser.safari) {
            const player = document.getElementById('bookPlayerContainer')!;
            this.addSwipeGestures(player);
        } else {
            this.rendition?.on('rendered', (_e: any, i: any) => this.addSwipeGestures(i.document.documentElement));
        }
    }

    unbindMediaElementEvents(): void {
        const elem = this.mediaElement!;

        elem.removeEventListener('close', this.onDialogClosed);
        elem.querySelector('#btnBookplayerExit')!.removeEventListener('click', this.onDialogClosed);
        elem.querySelector('#btnBookplayerToc')!.removeEventListener('click', this.openTableOfContents);
        elem.querySelector('#btnBookplayerFullscreen')!.removeEventListener('click', this.toggleFullscreen);
        elem.querySelector('#btnBookplayerRotateTheme')!.removeEventListener('click', this.rotateTheme);
        elem.querySelector('#btnBookplayerIncreaseFontSize')!.removeEventListener('click', this.increaseFontSize);
        elem.querySelector('#btnBookplayerDecreaseFontSize')!.removeEventListener('click', this.decreaseFontSize);
        elem.querySelector('#btnBookplayerPrev')?.removeEventListener('click', this.previous);
        elem.querySelector('#btnBookplayerNext')?.removeEventListener('click', this.next);
        elem.querySelector('#btnBookplayerListen')?.removeEventListener('click', this.toggleListen);
        elem.querySelector('#btnTtsPlayPause')?.removeEventListener('click', this.toggleTtsPlayPause);
        elem.querySelector('#btnTtsStop')?.removeEventListener('click', this.stopSpeech);
    }

    unbindEvents(): void {
        if (this.mediaElement) {
            this.unbindMediaElementEvents();
        }

        document.removeEventListener('keydown', this.onWindowKeyDown);
        this.rendition?.off('keydown', this.onWindowKeyDown);

        if (!browser.safari) {
            this.rendition?.off('rendered', (_e: any, i: any) => this.addSwipeGestures(i.document.documentElement));
        }

        this.touchHelper?.destroy();
    }

    getPlayerHeight(): number {
        if (layoutManager.mobile) {
            // we have no method from NativeShell to get the required margin for mobile devices
            return this.fullscreen ? 0.9 : 0.94;
        }

        // desktop needs slightly less space than mobile
        return 0.958;
    }

    openTableOfContents(): void {
        if (this.loaded) {
            this.tocElement = new TableOfContents(this);
        }
    }

    flattenNavigationChapters(chapters: any[], book: any, depth: number = 0): Chapter[] {
        if (!chapters?.length) return [];

        return chapters.flatMap((chapter: any) => {
            const link = chapter.href?.startsWith('../') ? chapter.href.slice(3) : chapter.href;
            const href = link ? book.path.directory + link : '';
            const mappedChapter: Chapter = {
                href,
                label: chapter.label || href || 'Capítulo',
                depth,
                source: 'navigation'
            };

            return [
                mappedChapter,
                ...this.flattenNavigationChapters(chapter.subitems, book, depth + 1)
            ];
        }).filter((chapter: Chapter) => chapter.href);
    }

    normalizeChapterLabel(label: string): string {
        return (label || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    isLikelyChapterHeading(element: Element, label: string): boolean {
        const tagName = element.tagName?.toLowerCase();
        const classAndId = `${element.className || ''} ${element.id || ''}`.toLowerCase();

        return tagName === 'h1'
            || tagName === 'h2'
            || CHAPTER_LABEL_REGEX.test(label)
            || classAndId.includes('chapter')
            || classAndId.includes('capitulo')
            || classAndId.includes('capítulo');
    }

    async loadSpineDocument(book: any, spineItem: any): Promise<Document | null> {
        try {
            if (spineItem.document) {
                return spineItem.document;
            }

            if (typeof spineItem.load === 'function') {
                return await spineItem.load(book.load.bind(book));
            }
        } catch (err) {
            console.warn('Failed to inspect book spine item for chapters:', err);
        }

        return null;
    }

    getChapterHrefFromElement(spineItem: any, element: HTMLElement): string {
        const href = spineItem.href || spineItem.url || '';

        if (!href) return '';

        if (!element.id) {
            autoChapterId += 1;
            element.id = `mulletaflix-auto-chapter-${autoChapterId}`;
        }

        return `${href}#${element.id}`;
    }

    async detectChaptersFromSpine(book: any): Promise<Chapter[]> {
        const spineItems = book?.spine?.spineItems || [];
        const chapters: Chapter[] = [];
        const seen = new Set<string>();

        for (const spineItem of spineItems) {
            const document = await this.loadSpineDocument(book, spineItem);
            if (!document) continue;

            const headings = document.querySelectorAll(CHAPTER_HEADING_SELECTORS.join(','));

            for (const heading of Array.from(headings)) {
                const label = this.normalizeChapterLabel(heading.textContent || '');
                if (!label || label.length < 2 || label.length > 140 || !this.isLikelyChapterHeading(heading, label)) {
                    continue;
                }

                const href = this.getChapterHrefFromElement(spineItem, heading as HTMLElement);
                const key = `${href}|${label.toLowerCase()}`;
                if (!href || seen.has(key)) {
                    continue;
                }

                seen.add(key);
                chapters.push({
                    href,
                    label,
                    depth: heading.tagName?.toLowerCase() === 'h3' ? 1 : 0,
                    source: 'auto'
                });
            }
        }

        return chapters;
    }

    async buildChapterMap(book: any): Promise<void> {
        const navigationChapters = this.flattenNavigationChapters(book?.navigation, book);

        if (navigationChapters.length) {
            this.chapterMap = navigationChapters;
            this.chapterMapReady = true;
        }

        const detectedChapters = await this.detectChaptersFromSpine(book);

        if (!navigationChapters.length || detectedChapters.length > navigationChapters.length) {
            this.chapterMap = detectedChapters;
        }

        this.chapterMapReady = true;
    }

    toggleFullscreen(): void {
        const icon = document.querySelector('#btnBookplayerFullscreen .material-icons')!;
        const buttons = document.querySelector('.topButtons')!;

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

    rotateTheme(): void {
        if (this.loaded) {
            const newTheme = THEME_ORDER[(THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length];
            this.rendition.themes.register('default', THEMES[newTheme]);
            this.rendition.themes.update('default');
            this.theme = newTheme;
        }
    }

    increaseFontSize(): void {
        if (this.loaded && this.fontSize !== FONT_SIZES[FONT_SIZES.length - 1]) {
            const newFontSize = FONT_SIZES[(FONT_SIZES.indexOf(this.fontSize) + 1)] as FontSize;
            this.rendition.themes.fontSize(newFontSize);
            this.fontSize = newFontSize;
        }
    }

    decreaseFontSize(): void {
        if (this.loaded && this.fontSize !== FONT_SIZES[0]) {
            const newFontSize = FONT_SIZES[(FONT_SIZES.indexOf(this.fontSize) - 1)] as FontSize;
            this.rendition.themes.fontSize(newFontSize);
            this.fontSize = newFontSize;
        }
    }

    previous(e?: Event): void {
        e?.preventDefault();
        if (this.rendition) {
            this.rendition.book.package.metadata.direction === 'rtl' ? this.rendition.next() : this.rendition.prev();
        }
    }

    next(e?: Event): void {
        e?.preventDefault();
        if (this.rendition) {
            this.rendition.book.package.metadata.direction === 'rtl' ? this.rendition.prev() : this.rendition.next();
        }
    }

    onVoicesChanged(): void {
        this.populateVoices();
    }

    populateVoices(): void {
        if (typeof speechSynthesis === 'undefined') return;
        this.ttsVoices = speechSynthesis.getVoices();
        const select = document.getElementById('ttsVoiceSelect') as HTMLSelectElement | null;
        const langSelect = document.getElementById('ttsLangSelect') as HTMLSelectElement | null;
        if (!select) return;
        const currentVal = select.value;
        const selectedLang = langSelect ? langSelect.value : '';
        select.innerHTML = '';
        this.ttsVoices.forEach(function (voice: SpeechSynthesisVoice) {
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

    createVisiblePageRange(location: any): string | null {
        const startCfi = location?.start?.cfi;
        const endCfi = location?.end?.cfi;
        const EpubCFI = this.epubjs?.CFI;

        if (!startCfi || !endCfi || !EpubCFI) {
            return null;
        }

        const start = new EpubCFI(startCfi);
        const end = new EpubCFI(endCfi);

        if (!start.base?.steps?.length || !end.base?.steps?.length || start.spinePos !== end.spinePos) {
            return null;
        }

        let sharedSteps = 0;
        const maxSharedSteps = Math.min(start.path.steps.length, end.path.steps.length);

        while (sharedSteps < maxSharedSteps) {
            const startStep = start.path.steps[sharedSteps];
            const endStep = end.path.steps[sharedSteps];

            if (!startStep || !endStep || startStep.type !== endStep.type || startStep.index !== endStep.index || startStep.id !== endStep.id) {
                break;
            }

            sharedSteps += 1;
        }

        const range = new EpubCFI();
        range.range = true;
        range.base = start.base;
        range.path = {
            steps: start.path.steps.slice(0, sharedSteps),
            terminal: null
        };
        range.start = {
            steps: start.path.steps.slice(sharedSteps),
            terminal: start.path.terminal
        };
        range.end = {
            steps: end.path.steps.slice(sharedSteps),
            terminal: end.path.terminal
        };

        return range.toString();
    }

    async extractTextFromPage(location?: any): Promise<string> {
        if (!this.rendition) return '';

        const visibleRange = this.createVisiblePageRange(location);
        if (visibleRange) {
            try {
                const range = await this.rendition.book.getRange(visibleRange);
                const text = range?.toString()?.trim();
                if (text) {
                    return text;
                }
            } catch (err) {
                console.warn('Failed to extract visible book text for TTS:', err);
            }
        }

        const contents = this.rendition.getContents();
        return contents
            .map((content: any) => content?.document?.body?.textContent || '')
            .join('\n')
            .trim();
    }

    toggleListen(): void {
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
            setMaterialIcon(icon, 'volume_up');
            this.ttsActive = false;
        } else {
            panel.classList.remove('hide');
            setMaterialIcon(icon, 'volume_off');
            this.ttsActive = true;
            this.populateVoices();
            setMaterialIcon(document.querySelector('#btnTtsPlayPause .material-icons'), 'play_arrow');
        }
    }

    async speakCurrentPage(location?: any): Promise<void> {
        if (typeof speechSynthesis === 'undefined' || !this.ttsActive) return;

        const requestId = ++this.ttsRequestId;
        speechSynthesis.cancel();
        const currentLocation = location || (this.rendition?.currentLocation ? this.rendition.currentLocation() : null);
        const resolvedLocation = await Promise.resolve(currentLocation);
        const text = await this.extractTextFromPage(resolvedLocation);
        if (!text || !this.ttsActive || requestId !== this.ttsRequestId) {
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const voiceSelect = document.getElementById('ttsVoiceSelect') as HTMLSelectElement | null;
        const speedSelect = document.getElementById('ttsSpeedSelect') as HTMLSelectElement | null;

        if (voiceSelect && voiceSelect.value) {
            const selectedVoice = this.ttsVoices.find(function (v: SpeechSynthesisVoice) {
                return v.name === voiceSelect.value;
            });
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
        setMaterialIcon(playPauseIcon, 'pause');

        speechSynthesis.speak(utterance);
        setTimeout(() => {
            if (this.ttsUtterance === utterance && speechSynthesis.paused) {
                speechSynthesis.resume();
            }
        }, 100);
    }

    toggleTtsPlayPause(): void {
        if (!this.ttsUtterance || !speechSynthesis.speaking) {
            void this.speakCurrentPage();
            return;
        }
        const icon = document.querySelector('#btnTtsPlayPause .material-icons');
        if (this.ttsPaused) {
            speechSynthesis.resume();
            this.ttsPaused = false;
            setMaterialIcon(icon, 'pause');
        } else {
            speechSynthesis.pause();
            this.ttsPaused = true;
            setMaterialIcon(icon, 'play_arrow');
        }
    }

    stopSpeech(): void {
        if (typeof speechSynthesis === 'undefined') return;
        this.ttsRequestId += 1;
        speechSynthesis.cancel();
        this.ttsUtterance = null;
        this.ttsPaused = false;
        const playPauseIcon = document.querySelector('#btnTtsPlayPause .material-icons');
        setMaterialIcon(playPauseIcon, 'play_arrow');
    }

    onTtsEnd(): void {
        this.ttsUtterance = null;
        this.ttsPaused = false;
        const playPauseIcon = document.querySelector('#btnTtsPlayPause .material-icons');
        setMaterialIcon(playPauseIcon, 'play_arrow');
    }

    async autoUploadCover(book: any): Promise<void> {
        const item = this.item;
        if (!item || !item.Id) return;
        if (item.ImageTags?.Primary) return;

        try {
            const rendition = this.rendition;
            const coverBook = book || rendition?.book;
            const firstPageCfi = coverBook?.locations?.cfiFromPercentage(0);

            if (!rendition || !coverBook || !firstPageCfi) return;

            const currentLocation = await Promise.resolve(rendition.currentLocation?.());
            const restoreTarget = currentLocation?.start?.cfi || currentLocation?.end?.cfi || null;

            try {
                if (restoreTarget && restoreTarget !== firstPageCfi) {
                    await rendition.display(firstPageCfi);
                }

                const text = await this.extractTextFromPage();
                if (!text) return;

                const lines = text.split('\n').filter(Boolean);
                const title = item.Name || 'Book';
                const preview = lines.slice(0, 20).join('\n').substring(0, 1500);

                const canvas = document.createElement('canvas');
                canvas.width = 600;
                canvas.height = 800;
                const ctx = canvas.getContext('2d')!;

                ctx.fillStyle = '#f5f0eb';
                ctx.fillRect(0, 0, 600, 800);

                ctx.fillStyle = '#2c2c2c';
                ctx.font = 'bold 28px Georgia, serif';
                ctx.textAlign = 'center';
                const titleY = 120;
                this.wrapText(ctx, title, 300, titleY, 500, 34);
                const textY = titleY + 60;

                ctx.fillStyle = '#444';
                ctx.font = '16px Georgia, serif';
                ctx.textAlign = 'left';
                this.wrapText(ctx, preview, 50, textY, 500, 24);

                canvas.toBlob(function (pngBlob: Blob | null) {
                    if (!pngBlob) {
                        return;
                    }
                    const file = new File([pngBlob], 'cover.png', { type: 'image/png' });
                    const apiClient = ServerConnections.getApiClient(item.ServerId) as any as BookUploadApiClient;
                    apiClient
                        .uploadItemImage(item.Id, 0, file)
                        .catch((error: any) => {
                            console.debug('Cover upload failed', error);
                        });
                }, 'image/png');
            } finally {
                if (restoreTarget && restoreTarget !== firstPageCfi) {
                    await rendition.display(restoreTarget);
                }
            }
        } catch (err) {
            console.error('Cover auto-upload failed:', err);
        }
    }

    wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
        const words = text.split(' ');
        let line = '';
        let cy = y;
        for (const word of words) {
            const testLine = line + (line ? ' ' : '') + word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && line) {
                ctx.fillText(line, x, cy);
                line = word;
                cy += lineHeight;
            } else {
                line = testLine;
            }
        }
        if (line) {
            ctx.fillText(line, x, cy);
        }
    }

    createMediaElement(): HTMLElement {
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

    setCurrentSrc(elem: HTMLElement, options: PlayOptions): Promise<void> {
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
            (document.getElementById('btnBookplayerFullscreen') as HTMLElement).style.display = 'none';
        }

        return new Promise((resolve, reject) => {
            import('epubjs').then(({ default: epubjs }) => {
                this.epubjs = epubjs;
                const api = toApi(ServerConnections.getApiClient(item) as never);
                const bookReaderHref = api.getUri(`BookReader/Items/${item.Id}/BookReader/Epub`);
                const book = epubjs(bookReaderHref, { openAs: 'epub' });

                const rendition = book.renderTo('bookPlayerContainer', {
                    width: '100%',
                    height: document.body.clientHeight * this.getPlayerHeight(),
                    // TODO: Add option for scrolled-doc
                    flow: 'paginated'
                });

                this.currentSrc = bookReaderHref;
                this.rendition = rendition;

                rendition.themes.register('default', THEMES[this.theme]);
                rendition.themes.select('default');

                return rendition.display().then(() => {
                    const epubElem = document.querySelector('.epub-container') as HTMLElement;
                    epubElem.style.opacity = '0';

                    this.bindEvents();

                    const autoUploadCover = this.autoUploadCover.bind(this, book);

                    return this.rendition.book.locations.generate(1024).then(async () => {
                        if (this.cancellationToken) reject();

                        await this.buildChapterMap(book);

                        const percentageTicks = (options.startPositionTicks || 0) / 10000000;
                        if (percentageTicks !== 0.0) {
                            const resumeLocation = book.locations.cfiFromPercentage(percentageTicks);
                            await rendition.display(resumeLocation);
                        }

                        this.loaded = true;
                        rendition.on('relocated', (locations: any) => {
                            this.progress = book.locations.percentageFromCfi(locations.start.cfi);
                            Events.trigger(this, 'pause');
                            if (this.ttsActive) {
                                void this.speakCurrentPage(locations);
                            }
                        });

                        epubElem.style.opacity = '';

                        setTimeout(autoUploadCover, 500);

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

    canPlayMediaType(mediaType: string): boolean {
        return (mediaType || '').toLowerCase() === 'book';
    }

    canPlayItem(item: { Path?: string }): boolean {
        const dotIndex = item.Path?.lastIndexOf('.') ?? -1;
        const ext = dotIndex >= 0 ? item.Path!.slice(dotIndex).toLowerCase() : '';
        return !!ext && BOOK_EXTENSIONS.has(ext);
    }
}

export default BookPlayer;
