import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { Archive } from 'libarchive.js';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';

import loading from '../../components/loading/loading';
import dialogHelper from '../../components/dialogHelper/dialogHelper';
import keyboardnavigation from '../../scripts/keyboardNavigation';
import { appRouter } from '../../components/router/appRouter';
import * as userSettings from '../../scripts/settings/userSettings';
import { PluginType } from '../../types/plugin.ts';
import Events from '../../utils/events.ts';

import './style.scss';

// supported book file extensions
const FILE_EXTENSIONS = ['.cbr', '.cbt', '.cbz', '.cb7'];
// the comic book archive supports any kind of image format as it's just a zip archive
const IMAGE_FORMATS = ['jpg', 'jpeg', 'jpe', 'jif', 'jfif', 'jfi', 'png', 'avif', 'gif', 'bmp', 'dib', 'tiff', 'tif', 'webp'];

interface PlayOptions {
    items: Array<{ Id?: string; ServerId?: string; Path?: string }>;
    startPositionTicks?: number;
}

interface ComicsPlayerSettings {
    langDir?: string;
    pagesPerView?: number;
}

export class ComicsPlayer {
    name: string;
    type: PluginType;
    id: string;
    priority: number;
    imageMap: Map<string, unknown>;
    mediaElement: HTMLElement | null = null;
    item: any;
    streamInfo: any;
    currentPage: number = 0;
    pageCount: number = 0;
    comicsPlayerSettings: ComicsPlayerSettings = {};
    swiperInstance: any;
    archiveSource: ArchiveSource | null = null;

    private readonly handleDialogClosed: () => void;
    private readonly handleWindowKeyDown: (e: KeyboardEvent) => void;
    private readonly handleDirChanged: () => void;
    private readonly handleViewChanged: () => void;

    constructor() {
        this.name = 'Comics Player';
        this.type = PluginType.MediaPlayer;
        this.id = 'comicsplayer';
        this.priority = 1;
        this.imageMap = new Map();

        this.handleDialogClosed = this.onDialogClosed.bind(this);
        this.handleWindowKeyDown = this.onWindowKeyDown.bind(this);
        this.handleDirChanged = this.onDirChanged.bind(this);
        this.handleViewChanged = this.onViewChanged.bind(this);
    }

    play(options: PlayOptions): Promise<void> {
        this.currentPage = 0;
        this.pageCount = 0;

        const mediaSourceId = options.items[0].Id!;
        this.comicsPlayerSettings = userSettings.getComicsPlayerSettings(mediaSourceId);

        const elem = this.createMediaElement();
        return this.setCurrentSrc(elem, options);
    }

    stop(): void {
        this.unbindEvents();

        const stopInfo = {
            src: this.item
        };

        Events.trigger(this, 'stopped', [stopInfo]);

        const mediaSourceId = this.item.Id;
        userSettings.setComicsPlayerSettings(this.comicsPlayerSettings as Record<string, unknown>, mediaSourceId);

        this.archiveSource?.release();

        const elem = this.mediaElement;
        if (elem) {
            dialogHelper.close(elem);
            this.mediaElement = null;
        }

        loading.hide();
    }

    destroy(): void {
        // Nothing to do here
    }

    currentTime(): number {
        return this.currentPage;
    }

    duration(): number {
        return this.pageCount;
    }

    currentItem(): any {
        return this.item;
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

    onDialogClosed(): void {
        this.stop();
    }

    onDirChanged(): void {
        let langDir = this.comicsPlayerSettings.langDir;

        if (!langDir || langDir === 'ltr') {
            langDir = 'rtl';
        } else {
            langDir = 'ltr';
        }

        this.changeLanguageDirection(langDir);

        this.comicsPlayerSettings.langDir = langDir;
    }

    changeLanguageDirection(langDir: string): void {
        const currentPage = this.currentPage;

        this.swiperInstance.changeLanguageDirection(langDir);

        const prevIcon = langDir === 'ltr' ? 'arrow_circle_left' : 'arrow_circle_right';
        this.mediaElement!.querySelector('.btnToggleLangDir > span')!.classList.remove(prevIcon);

        const newIcon = langDir === 'ltr' ? 'arrow_circle_right' : 'arrow_circle_left';
        this.mediaElement!.querySelector('.btnToggleLangDir > span')!.classList.add(newIcon);

        const dirTitle = langDir === 'ltr' ? 'Right To Left' : 'Left To Right';
        (this.mediaElement!.querySelector('.btnToggleLangDir') as HTMLElement).title = dirTitle;

        this.reload(currentPage);
    }

    onViewChanged(): void {
        let view = this.comicsPlayerSettings.pagesPerView;

        if (!view || view === 1) {
            view = 2;
        } else {
            view = 1;
        }

        this.changeView(view);

        this.comicsPlayerSettings.pagesPerView = view;
    }

    changeView(view: number): void {
        const currentPage = this.currentPage;

        this.swiperInstance.params.slidesPerView = view;
        this.swiperInstance.params.slidesPerGroup = view;

        const prevIcon = view === 1 ? 'devices_fold' : 'import_contacts';
        this.mediaElement!.querySelector('.btnToggleView > span')!.classList.remove(prevIcon);

        const newIcon = view === 1 ? 'import_contacts' : 'devices_fold';
        this.mediaElement!.querySelector('.btnToggleView > span')!.classList.add(newIcon);

        const viewTitle = view === 1 ? 'Double Page View' : 'Single Page View';
        (this.mediaElement!.querySelector('.btnToggleView') as HTMLElement).title = viewTitle;

        this.reload(currentPage);
    }

    reload(currentPage: number): void {
        const effect = this.swiperInstance.params.effect;

        this.swiperInstance.params.effect = 'none';
        this.swiperInstance.update();

        this.swiperInstance.slideNext();
        this.swiperInstance.slidePrev();

        if (this.currentPage != currentPage) {
            this.swiperInstance.slideTo(currentPage);
            this.swiperInstance.update();
        }

        this.swiperInstance.params.effect = effect;
        this.swiperInstance.update();
    }

    onWindowKeyDown(e: KeyboardEvent): void {
        // Skip modified keys
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        const key = keyboardnavigation.getKeyName(e);
        if (key === 'Escape') {
            e.preventDefault();
            this.stop();
        }
    }

    bindMediaElementEvents(): void {
        const elem = this.mediaElement;

        elem?.addEventListener('close', this.handleDialogClosed, { once: true });
        elem?.querySelector('.btnExit')!.addEventListener('click', this.handleDialogClosed, { once: true });
        elem?.querySelector('.btnToggleLangDir')!.addEventListener('click', this.handleDirChanged);
        elem?.querySelector('.btnToggleView')!.addEventListener('click', this.handleViewChanged);
    }

    bindEvents(): void {
        this.bindMediaElementEvents();

        document.addEventListener('keydown', this.handleWindowKeyDown);
    }

    unbindMediaElementEvents(): void {
        const elem = this.mediaElement;

        elem?.removeEventListener('close', this.handleDialogClosed);
        elem?.querySelector('.btnExit')!.removeEventListener('click', this.handleDialogClosed);
        elem?.querySelector('.btnToggleLangDir')!.removeEventListener('click', this.handleDirChanged);
        elem?.querySelector('.btnToggleView')!.removeEventListener('click', this.handleViewChanged);
    }

    unbindEvents(): void {
        this.unbindMediaElementEvents();

        document.removeEventListener('keydown', this.handleWindowKeyDown);
    }

    createMediaElement(): HTMLElement {
        let elem = this.mediaElement;
        if (elem) {
            return elem;
        }

        elem = document.getElementById('comicsPlayer');
        if (!elem) {
            elem = dialogHelper.createDialog({
                exitAnimationDuration: 400,
                size: 'fullscreen',
                autoFocus: false,
                scrollY: false,
                exitAnimation: 'fadeout',
                removeOnClose: true
            });

            const viewIcon = this.comicsPlayerSettings.pagesPerView === 1 ? 'import_contacts' : 'devices_fold';
            const dirIcon = this.comicsPlayerSettings.langDir === 'ltr' ? 'arrow_circle_right' : 'arrow_circle_left';

            elem.id = 'comicsPlayer';
            elem.classList.add('slideshowDialog');
            elem.innerHTML = `<div dir=${this.comicsPlayerSettings.langDir} class="slideshowSwiperContainer">
                                <div class="swiper-wrapper"></div>
                                <div class="swiper-button-next actionButtonIcon"></div>
                                <div class="swiper-button-prev actionButtonIcon"></div>
                                <div class="swiper-pagination"></div>
                            </div>
                            <div class="actionButtons">
                                <button is="paper-icon-button-light" class="autoSize btnToggleLangDir" tabindex="-1">
                                    <span class="material-icons actionButtonIcon ${dirIcon}" aria-hidden="true"></span>
                                </button>
                                <button is="paper-icon-button-light" class="autoSize btnToggleView" tabindex="-1">
                                    <span class="material-icons actionButtonIcon ${viewIcon}" aria-hidden="true"></span>
                                </button>
                                <button is="paper-icon-button-light" class="autoSize btnExit" tabindex="-1">
                                    <span class="material-icons actionButtonIcon close" aria-hidden="true"></span>
                                </button>
                            </div>`;

            dialogHelper.open(elem);
        }

        this.mediaElement = elem;

        const dirTitle = this.comicsPlayerSettings.langDir === 'ltr' ? 'Right To Left' : 'Left To Right';
        (this.mediaElement.querySelector('.btnToggleLangDir') as HTMLElement).title = dirTitle;

        const viewTitle = this.comicsPlayerSettings.pagesPerView === 1 ? 'Double Page View' : 'Single Page View';
        (this.mediaElement.querySelector('.btnToggleView') as HTMLElement).title = viewTitle;

        this.bindEvents();
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

        loading.show();

        Archive.init({
            workerUrl: appRouter.baseUrl() + '/libraries/worker-bundle.js'
        });

        const api = toApi(ServerConnections.getApiClient(item) as never);
        const downloadUrl = getLibraryApi(api).getDownloadUrl({ itemId: item.Id! });
        this.archiveSource = new ArchiveSource(downloadUrl);

        //eslint-disable-next-line import/no-unresolved
        import('swiper/css/bundle');

        return this.archiveSource.load()
            // eslint-disable-next-line import/no-unresolved
            .then(() => import('swiper/bundle'))
            .then(({ Swiper }) => {
                loading.hide();

                this.pageCount = this.archiveSource!.urls.length;
                this.currentPage = (options.startPositionTicks || 0) / 10000 || 0;

                this.swiperInstance = new Swiper(elem.querySelector('.slideshowSwiperContainer') as HTMLElement, {
                    direction: 'horizontal',
                    // loop is disabled due to the lack of Swiper support in virtual slides
                    loop: false,
                    zoom: {
                        minRatio: 1,
                        toggle: true,
                        containerClass: 'slider-zoom-container'
                    },
                    autoplay: false,
                    keyboard: {
                        enabled: true
                    },
                    preloadImages: true,
                    slidesPerView: this.comicsPlayerSettings.pagesPerView,
                    slidesPerGroup: this.comicsPlayerSettings.pagesPerView,
                    slidesPerColumn: 1,
                    initialSlide: this.currentPage,
                    navigation: {
                        nextEl: '.swiper-button-next',
                        prevEl: '.swiper-button-prev'
                    },
                    pagination: {
                        el: '.swiper-pagination',
                        clickable: true,
                        type: 'fraction'
                    },
                    // reduces memory consumption for large libraries while allowing preloading of images
                    virtual: {
                        slides: this.archiveSource!.urls,
                        cache: true,
                        renderSlide: this.getImgFromUrl,
                        addSlidesBefore: 1,
                        addSlidesAfter: 1
                    }
                } as any);

                // save current page ( a page is an image file inside the archive )
                this.swiperInstance.on('slideChange', () => {
                    this.currentPage = this.swiperInstance.activeIndex;
                    Events.trigger(this, 'pause');
                });
            });
    }

    getImgFromUrl(url: string): string {
        return `<div class="swiper-slide">
                   <div class="slider-zoom-container">
                       <img src="${url}" class="swiper-slide-img">
                   </div>
               </div>`;
    }

    canPlayMediaType(mediaType: string): boolean {
        return (mediaType || '').toLowerCase() === 'book';
    }

    canPlayItem(item: { Path?: string }): boolean {
        return !!item.Path && FILE_EXTENSIONS.some(ext => item.Path!.endsWith(ext));
    }
}

class ArchiveSource {
    private url: string;
    private files: any[];
    urls: string[];
    private archive: any;
    private raw: any;

    constructor(url: string) {
        this.url = url;
        this.files = [];
        this.urls = [];
    }

    async load(): Promise<void> {
        const res = await fetch(this.url);
        if (!res.ok) {
            return;
        }

        const blob = await res.blob();
        this.archive = await Archive.open(blob as unknown as File);
        this.raw = await this.archive.getFilesArray();
        await this.archive.extractFiles();

        let files = await this.archive.getFilesArray();

        // metadata files and files without a file extension should not be considered as a page
        files = files.filter((file: { file: { name: string } }) => {
            const name = file.file.name;
            const index = name.lastIndexOf('.');
            return index !== -1 && IMAGE_FORMATS.includes(name.slice(index + 1).toLowerCase());
        });
        files.sort((a: { file: { name: string } }, b: { file: { name: string } }) => {
            if (a.file.name < b.file.name) {
                return -1;
            } else {
                return 1;
            }
        });

        for (const file of files) {
            const url = URL.createObjectURL(file.file);
            this.urls.push(url);
        }
    }

    release(): void {
        this.files = [];
        this.urls.forEach(URL.revokeObjectURL);
        this.urls = [];
    }
}

export default ComicsPlayer;
