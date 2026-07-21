import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';

import { toApi } from 'utils/jellyfin-apiclient/compat';

import loading from '../../components/loading/loading';
import keyboardnavigation from '../../scripts/keyboardNavigation';
import dialogHelper from '../../components/dialogHelper/dialogHelper';
import dom from '../../utils/dom';
import { appRouter } from '../../components/router/appRouter';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { PluginType } from '../../types/plugin.ts';
import Events from '../../utils/events.ts';

import './style.scss';
import '../../elements/emby-button/paper-icon-button-light';

interface PlayOptions {
    items: Array<{ Id?: string; ServerId?: string; Path?: string }>;
    startPositionTicks?: number;
}

export class PdfPlayer {
    name: string;
    type: PluginType;
    id: string;
    priority: number;
    mediaElement: HTMLElement | null = null;
    item: any;
    streamInfo: any;
    progress: number = 0;
    loaded: boolean = false;
    cancellationToken: boolean = false;
    pages: Record<string, HTMLCanvasElement> = {};
    book: any;

    private readonly handleDialogClosed: () => void;
    private readonly handleWindowKeyDown: (e: KeyboardEvent) => void;
    private readonly handleTouchStart: (e: TouchEvent) => void;

    constructor() {
        this.name = 'PDF Player';
        this.type = PluginType.MediaPlayer;
        this.id = 'pdfplayer';
        this.priority = 1;

        this.handleDialogClosed = this.onDialogClosed.bind(this);
        this.handleWindowKeyDown = this.onWindowKeyDown.bind(this);
        this.handleTouchStart = this.onTouchStart.bind(this);
    }

    play(options: PlayOptions): Promise<void> {
        this.progress = 0;
        this.loaded = false;
        this.cancellationToken = false;
        this.pages = {};

        loading.show();

        const elem = this.createMediaElement();
        return this.setCurrentSrc(elem, options);
    }

    stop(): void {
        this.unbindEvents();

        const stopInfo = {
            src: this.item
        };

        Events.trigger(this, 'stopped', [stopInfo]);

        const elem = this.mediaElement;
        if (elem) {
            dialogHelper.close(elem);
            this.mediaElement = null;
        }

        // hide loading animation
        loading.hide();

        // cancel page render
        this.cancellationToken = true;
    }

    destroy(): void {
        // Nothing to do here
    }

    currentItem(): any {
        return this.item;
    }

    currentTime(): number {
        return this.progress;
    }

    duration(): number {
        return this.book ? this.book.numPages : 0;
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
        if (!this.loaded) return;

        // Skip modified keys
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        const key = keyboardnavigation.getKeyName(e);

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
                this.stop();
                break;
        }
    }

    onTouchStart(e: TouchEvent): void {
        if (!this.loaded || !e.touches || e.touches.length === 0) return;
        if (e.touches[0].clientX < dom.getWindowSize().innerWidth / 2) {
            this.previous();
        } else {
            this.next();
        }
    }

    onDialogClosed(): void {
        this.stop();
    }

    bindMediaElementEvents(): void {
        const elem = this.mediaElement!;

        elem.addEventListener('close', this.handleDialogClosed, { once: true });
        elem.querySelector('.btnExit')!.addEventListener('click', this.handleDialogClosed, { once: true });
    }

    bindEvents(): void {
        this.bindMediaElementEvents();

        document.addEventListener('keydown', this.handleWindowKeyDown);
        document.addEventListener('touchstart', this.handleTouchStart);
    }

    unbindMediaElementEvents(): void {
        const elem = this.mediaElement!;

        elem.removeEventListener('close', this.handleDialogClosed);
        elem.querySelector('.btnExit')!.removeEventListener('click', this.handleDialogClosed);
    }

    unbindEvents(): void {
        if (this.mediaElement) {
            this.unbindMediaElementEvents();
        }

        document.removeEventListener('keydown', this.handleWindowKeyDown);
        document.removeEventListener('touchstart', this.handleTouchStart);
    }

    createMediaElement(): HTMLElement {
        let elem = this.mediaElement;
        if (elem) {
            return elem;
        }

        elem = document.getElementById('pdfPlayer');
        if (!elem) {
            elem = dialogHelper.createDialog({
                exitAnimationDuration: 400,
                size: 'fullscreen',
                autoFocus: false,
                scrollY: false,
                exitAnimation: 'fadeout',
                removeOnClose: true
            });

            let html = '';
            html += '<canvas id="canvas"></canvas>';
            html += '<div class="actionButtons">';
            html += '<button is="paper-icon-button-light" class="autoSize btnExit" tabindex="-1"><span class="material-icons actionButtonIcon close" aria-hidden="true"></span></button>';
            html += '</div>';

            elem.id = 'pdfPlayer';
            elem.innerHTML = html;

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

        return import('pdfjs-dist').then(({ GlobalWorkerOptions, getDocument }) => {
            const api = toApi(ServerConnections.getApiClient(item) as never);
            const downloadHref = getLibraryApi(api).getDownloadUrl({ itemId: item.Id! });

            this.bindEvents();
            GlobalWorkerOptions.workerSrc = appRouter.baseUrl() + '/libraries/pdf.worker.js';

            const downloadTask = getDocument({
                url: downloadHref,
                // Disable for PDF.js XSS vulnerability
                // https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq
                isEvalSupported: false
            } as never);
            return downloadTask.promise.then((book: any) => {
                if (this.cancellationToken) return;
                this.book = book;
                this.loaded = true;

                const percentageTicks = (options.startPositionTicks || 0) / 10000;
                if (percentageTicks !== 0) {
                    this.loadPage(percentageTicks + 1);
                    this.progress = percentageTicks;
                } else {
                    this.loadPage(1);
                }
            });
        });
    }

    next(): void {
        if (this.progress === this.duration() - 1) return;
        this.loadPage(this.progress + 2);
        this.progress = this.progress + 1;

        Events.trigger(this, 'pause');
    }

    previous(): void {
        if (this.progress === 0) return;
        this.loadPage(this.progress);
        this.progress = this.progress - 1;

        Events.trigger(this, 'pause');
    }

    replaceCanvas(canvas: HTMLCanvasElement): void {
        const old = document.getElementById('canvas')!;

        canvas.id = 'canvas';
        old.parentNode!.replaceChild(canvas, old);
    }

    loadPage(number: number): void {
        const prefix = 'page';
        const pad = 2;

        // generate list of cached pages by padding the requested page on both sides
        const pages = [prefix + number];
        for (let i = 1; i <= pad; i++) {
            if (number - i > 0) pages.push(prefix + (number - i));
            if (number + i < this.duration()) pages.push(prefix + (number + i));
        }

        // load any missing pages in the cache
        for (const page of pages) {
            if (!this.pages[page]) {
                this.pages[page] = document.createElement('canvas');
                this.renderPage(this.pages[page], parseInt(page.slice(4), 10));
            }
        }

        // show the requested page
        this.replaceCanvas(this.pages[prefix + number]);

        // delete all pages outside the cache area
        for (const page in this.pages) {
            if (!pages.includes(page)) {
                delete this.pages[page];
            }
        }
    }

    renderPage(canvas: HTMLCanvasElement, number: number): void {
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.book.getPage(number).then((page: any) => {
            const original = page.getViewport({ scale: 1 });
            const scale = Math.min((window.innerHeight / original.height), (window.innerWidth / original.width)) * devicePixelRatio;
            const viewport = page.getViewport({ scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            if (window.innerWidth < window.innerHeight) {
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
            } else {
                canvas.style.height = '100%';
                canvas.style.width = 'auto';
            }

            const context = canvas.getContext('2d')!;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
            renderTask.promise.then(() => {
                loading.hide();
            });
        });
    }

    canPlayMediaType(mediaType: string): boolean {
        return (mediaType || '').toLowerCase() === 'book';
    }

    canPlayItem(item: { Path?: string }): boolean {
        return item.Path ? item.Path.toLowerCase().endsWith('pdf') : false;
    }
}

export default PdfPlayer;
