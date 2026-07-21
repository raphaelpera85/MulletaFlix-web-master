/**
 * Image viewer component
 * @module components/slideshow/slideshow
 */
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import screenfull from 'screenfull';

import { AppFeature } from 'constants/appFeature';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { randomInt } from 'utils/number';

import dialogHelper from '../dialogHelper/dialogHelper';
import inputManager from '../../scripts/inputManager';
import layoutManager from '../layoutManager';
import focusManager from '../focusManager';
import browser from '../../scripts/browser';
import { appHost } from '../apphost';
import dom from '../../utils/dom';

import './style.scss';
import 'material-design-icons-iconfont';
import '../../elements/emby-button/paper-icon-button-light';

const transitionEndEventName = dom.whichTransitionEvent();
const useFakeZoomImage = browser.safari;

interface SlideshowOptions {
    interactive?: boolean;
    autoplay?: boolean;
    startIndex?: number;
    slides?: SlideItem[];
    items?: SlideItem[];
    user?: any;
}

interface SlideItem {
    originalImage?: string | null;
    Id?: string;
    ServerId?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    MediaType?: string;
    BackdropImageTags?: string[];
    ImageTags?: Record<string, string>;
    PrimaryImageTag?: string;
    AlbumId?: string;
    AlbumPrimaryImageTag?: string;
    Id_?: string;
}

interface ImageInfo {
    url: string | null;
    shareUrl: string | null;
    itemId: string | null;
    serverId: string | null;
}

interface MouseMoveData {
    x: number;
    y: number;
}

function getImageUrl(item: SlideItem | string, options: Record<string, any>, apiClient: any): string | null {
    options = options || {};
    options.type = options.type || 'Primary';

    if (typeof (item) === 'string') {
        return apiClient.getScaledImageUrl(item, options);
    }

    const itemObj = item as SlideItem;
    if (itemObj.ImageTags?.[options.type]) {
        options.tag = itemObj.ImageTags[options.type];
        return apiClient.getScaledImageUrl(itemObj.Id, options);
    }

    if (options.type === 'Primary' && itemObj.AlbumId && itemObj.AlbumPrimaryImageTag) {
        options.tag = itemObj.AlbumPrimaryImageTag;
        return apiClient.getScaledImageUrl(itemObj.AlbumId, options);
    }

    return null;
}

function getBackdropImageUrl(item: SlideItem, options: Record<string, any>, apiClient: any): string | null {
    options = options || {};
    options.type = options.type || 'Backdrop';

    if (!options.maxWidth && !options.width && !options.maxHeight && !options.height && !options.fillWidth && !options.fillHeight) {
        options.quality = 100;
    }

    if (item.BackdropImageTags?.length) {
        options.index = randomInt(0, item.BackdropImageTags.length - 1);
        options.tag = item.BackdropImageTags[options.index];
        return apiClient.getScaledImageUrl(item.Id, options);
    }

    return null;
}

function getImgUrl(item: SlideItem, user: any): string | null {
    const apiClient = ServerConnections.getApiClient(item) as any;
    const api = toApi(apiClient);
    const imageOptions: Record<string, any> = {};

    if (item.BackdropImageTags?.length) {
        return getBackdropImageUrl(item, imageOptions, apiClient);
    } else {
        if (item.MediaType === 'Photo' && user?.Policy.EnableContentDownloading) {
            return getLibraryApi(api).getDownloadUrl({ itemId: item.Id! });
        }
        imageOptions.type = 'Primary';
        return getImageUrl(item, imageOptions, apiClient);
    }
}

function getIcon(icon: string, cssClass: string, canFocus: boolean, autoFocus?: boolean): string {
    const tabIndex = canFocus ? '' : ' tabindex="-1"';
    const autoFocusAttr = autoFocus ? ' autofocus' : '';
    return '<button is="paper-icon-button-light" class="autoSize ' + cssClass + '"' + tabIndex + autoFocusAttr + '><span class="material-icons slideshowButtonIcon ' + icon + '" aria-hidden="true"></span></button>';
}

function setUserScalable(scalable: boolean): void {
    try {
        appHost.setUserScalable(scalable);
    } catch (err) {
        console.error('error in appHost.setUserScalable: ' + err);
    }
}

export default function (this: any, options: SlideshowOptions): void {
    const self = this;
    let swiperInstance: any;
    let dialog: HTMLDivElement;
    let currentOptions: SlideshowOptions;
    let hideTimeout: ReturnType<typeof setTimeout> | null;
    let lastMouseMoveData: MouseMoveData | undefined;

    function createElements(slideshowOptions: SlideshowOptions): void {
        currentOptions = slideshowOptions;

        dialog = dialogHelper.createDialog({
            exitAnimationDuration: slideshowOptions.interactive ? 400 : 800,
            size: 'fullscreen',
            autoFocus: false,
            scrollY: false,
            exitAnimation: 'fadeout',
            removeOnClose: true
        }) as HTMLDivElement;

        dialog.classList.add('slideshowDialog');

        let html = '';

        html += '<div class="slideshowSwiperContainer"><div class="swiper-wrapper"></div></div>';

        if (slideshowOptions.interactive && !layoutManager.tv) {
            const actionButtonsOnTop = layoutManager.mobile;

            html += getIcon('keyboard_arrow_left', 'btnSlideshowPrevious slideshowButton hide-mouse-idle-tv', false);
            html += getIcon('keyboard_arrow_right', 'btnSlideshowNext slideshowButton hide-mouse-idle-tv', false);

            html += '<div class="topActionButtons">';
            if (actionButtonsOnTop) {
                html += getIcon('play_arrow', 'btnSlideshowPause slideshowButton', true);

                if (appHost.supports(AppFeature.FileDownload) && slideshowOptions.user?.Policy.EnableContentDownloading) {
                    html += getIcon('file_download', 'btnDownload slideshowButton', true);
                }
                if (appHost.supports(AppFeature.Sharing)) {
                    html += getIcon('share', 'btnShare slideshowButton', true);
                }
                if (screenfull.isEnabled) {
                    html += getIcon('fullscreen', 'btnFullscreen', true);
                    html += getIcon('fullscreen_exit', 'btnFullscreenExit hide', true);
                }
            }
            html += getIcon('close', 'slideshowButton btnSlideshowExit hide-mouse-idle-tv', false);
            html += '</div>';

            if (!actionButtonsOnTop) {
                html += '<div class="slideshowBottomBar hide">';

                html += getIcon('play_arrow', 'btnSlideshowPause slideshowButton', true, true);
                if (appHost.supports(AppFeature.FileDownload) && slideshowOptions?.user.Policy.EnableContentDownloading) {
                    html += getIcon('file_download', 'btnDownload slideshowButton', true);
                }
                if (appHost.supports(AppFeature.Sharing)) {
                    html += getIcon('share', 'btnShare slideshowButton', true);
                }
                if (screenfull.isEnabled) {
                    html += getIcon('fullscreen', 'btnFullscreen', true);
                    html += getIcon('fullscreen_exit', 'btnFullscreenExit hide', true);
                }

                html += '</div>';
            }
        } else {
            html += '<div class="slideshowImage"></div><h1 class="slideshowImageText"></h1>';
        }

        dialog.innerHTML = html;

        if (slideshowOptions.interactive && !layoutManager.tv) {
            dialog.querySelector('.btnSlideshowExit')!.addEventListener('click', function () {
                dialogHelper.close(dialog);
            });

            dialog.querySelector('.btnSlideshowPrevious')?.addEventListener('click', getClickHandler(null));
            dialog.querySelector('.btnSlideshowNext')?.addEventListener('click', getClickHandler(null));

            const btnPause = dialog.querySelector('.btnSlideshowPause');
            if (btnPause) {
                btnPause.addEventListener('click', getClickHandler(playPause));
            }

            const btnDownload = dialog.querySelector('.btnDownload');
            if (btnDownload) {
                btnDownload.addEventListener('click', getClickHandler(download));
            }

            const btnShare = dialog.querySelector('.btnShare');
            if (btnShare) {
                btnShare.addEventListener('click', getClickHandler(share));
            }

            const btnFullscreen = dialog.querySelector('.btnFullscreen');
            if (btnFullscreen) {
                btnFullscreen.addEventListener('click', getClickHandler(fullscreen));
            }

            const btnFullscreenExit = dialog.querySelector('.btnFullscreenExit');
            if (btnFullscreenExit) {
                btnFullscreenExit.addEventListener('click', getClickHandler(fullscreenExit));
            }

            if (screenfull.isEnabled) {
                screenfull.on('change', function () {
                    toggleFullscreenButtons(screenfull.isFullscreen);
                });
            }
        }

        setUserScalable(true);

        dialogHelper.open(dialog).then(function () {
            setUserScalable(false);
        });

        inputManager.on(window, onInputCommand);
        document.addEventListener((window.PointerEvent ? 'pointermove' : 'mousemove') as string, onPointerMove as EventListener);

        dialog.addEventListener('close', onDialogClosed);

        loadSwiper(dialog, options);

        if (layoutManager.desktop) {
            const topActionButtons = dialog.querySelector('.topActionButtons');
            if (topActionButtons) topActionButtons.classList.add('hide');
        }

        const btnSlideshowPrevious = dialog.querySelector('.btnSlideshowPrevious');
        if (btnSlideshowPrevious) btnSlideshowPrevious.classList.add('hide');
        const btnSlideshowNext = dialog.querySelector('.btnSlideshowNext');
        if (btnSlideshowNext) btnSlideshowNext.classList.add('hide');
    }

    function onAutoplayStart(): void {
        const btnSlideshowPause = dialog.querySelector('.btnSlideshowPause .material-icons');
        if (btnSlideshowPause) {
            btnSlideshowPause.classList.replace('play_arrow', 'pause');
        }
    }

    function onAutoplayStop(): void {
        const btnSlideshowPause = dialog.querySelector('.btnSlideshowPause .material-icons');
        if (btnSlideshowPause) {
            btnSlideshowPause.classList.replace('pause', 'play_arrow');
        }
    }

    function onZoomChange(swiper: any, scale: number, imageEl: HTMLElement, slideEl: HTMLElement): void {
        const zoomImage = slideEl.querySelector('.swiper-zoom-fakeimg') as HTMLElement;

        if (zoomImage) {
            zoomImage.style.width = zoomImage.style.height = scale * 100 + '%';

            if (scale > 1) {
                if (zoomImage.classList.contains('swiper-zoom-fakeimg-hidden')) {
                    setTimeout(() => {
                        const callback = () => {
                            imageEl.removeEventListener(transitionEndEventName!, callback);
                            zoomImage.classList.remove('swiper-zoom-fakeimg-hidden');
                        };

                        const transitionDuration = parseFloat(imageEl.style.transitionDuration.replace(/[a-z]/i, ''));

                        if (transitionDuration > 0) {
                            imageEl.addEventListener(transitionEndEventName!, callback);
                        } else {
                            callback();
                        }
                    }, 0);
                }
            } else {
                zoomImage.classList.add('swiper-zoom-fakeimg-hidden');
            }
        }
    }

    function loadSwiper(dialogElement: HTMLDivElement, swiperOptions: SlideshowOptions): void {
        let slides: SlideItem[];
        if (currentOptions.slides) {
            slides = currentOptions.slides;
        } else {
            slides = currentOptions.items!;
        }

        // @ts-ignore
        import('swiper/css/bundle');

        // @ts-ignore
        import('swiper/bundle').then(({ Swiper }) => {
            swiperInstance = new Swiper(dialogElement.querySelector('.slideshowSwiperContainer') as HTMLElement, {
                direction: 'horizontal',
                loop: false,
                zoom: {
                    minRatio: 1,
                    toggle: true
                },
                autoplay: swiperOptions.autoplay ?? !swiperOptions.interactive,
                keyboard: {
                    enabled: true
                },
                preloadImages: true,
                slidesPerView: 1,
                slidesPerColumn: 1,
                initialSlide: swiperOptions.startIndex || 0,
                speed: 240,
                navigation: {
                    nextEl: '.btnSlideshowNext',
                    prevEl: '.btnSlideshowPrevious'
                },
                virtual: {
                    slides: slides,
                    cache: true,
                    renderSlide: getSwiperSlideHtml,
                    addSlidesBefore: 1,
                    addSlidesAfter: 1
                }
            } as any);

            swiperInstance.on('autoplayStart', onAutoplayStart);
            swiperInstance.on('autoplayStop', onAutoplayStop);

            if (useFakeZoomImage) {
                swiperInstance.on('zoomChange', onZoomChange);
            }

            if (swiperInstance.autoplay?.running) onAutoplayStart();
        });
    }

    function getSwiperSlideHtml(item: SlideItem): string {
        if (currentOptions.slides) {
            return getSwiperSlideHtmlFromSlide(item);
        } else {
            return getSwiperSlideHtmlFromItem(item);
        }
    }

    function getSwiperSlideHtmlFromItem(item: SlideItem): string {
        return getSwiperSlideHtmlFromSlide({
            originalImage: getImgUrl(item, currentOptions.user),
            Id: item.Id,
            ServerId: item.ServerId
        });
    }

    function getSwiperSlideHtmlFromSlide(item: SlideItem): string {
        let html = '';
        html += '<div class="swiper-slide" data-original="' + item.originalImage + '" data-itemid="' + item.Id + '" data-serverid="' + item.ServerId + '">';
        html += '<div class="swiper-zoom-container">';
        if (useFakeZoomImage) {
            html += `<div class="swiper-zoom-fakeimg swiper-zoom-fakeimg-hidden" style="background-image: url('${item.originalImage}')"></div>`;
        }
        html += '<img src="' + item.originalImage + '" class="swiper-slide-img">';
        html += '</div>';
        if (item.title || item.subtitle) {
            html += '<div class="slideText">';
            html += '<div class="slideTextInner">';
            if (item.title) {
                html += '<h1 class="slideTitle">';
                html += item.title;
                html += '</h1>';
            }
            if (item.description) {
                html += '<div class="slideSubtitle">';
                html += item.description;
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';

        return html;
    }

    function getCurrentImageInfo(): ImageInfo | null {
        if (swiperInstance) {
            const slide = document.querySelector('.swiper-slide-active');

            if (slide) {
                return {
                    url: slide.getAttribute('data-original'),
                    shareUrl: slide.getAttribute('data-original'),
                    itemId: slide.getAttribute('data-itemid'),
                    serverId: slide.getAttribute('data-serverid')
                };
            }
            return null;
        } else {
            return null;
        }
    }

    function download(): void {
        const imageInfo = getCurrentImageInfo();

        import('../../scripts/fileDownloader').then((fileDownloader) => {
            fileDownloader.download([imageInfo as any]);
        });
    }

    function share(): void {
        const imageInfo = getCurrentImageInfo()!;

        navigator.share({
            url: imageInfo.shareUrl!
        });
    }

    function fullscreen(): void {
        if (!screenfull.isFullscreen) screenfull.request();
        toggleFullscreenButtons(true);
    }

    function fullscreenExit(): void {
        if (screenfull.isFullscreen) screenfull.exit();
        toggleFullscreenButtons(false);
    }

    function toggleFullscreenButtons(isFullscreen: boolean): void {
        const btnFullscreen = dialog.querySelector('.btnFullscreen');
        const btnFullscreenExit = dialog.querySelector('.btnFullscreenExit');
        if (btnFullscreen) {
            btnFullscreen.classList.toggle('hide', isFullscreen);
        }
        if (btnFullscreenExit) {
            btnFullscreenExit.classList.toggle('hide', !isFullscreen);
        }
    }

    function play(): void {
        if (swiperInstance.autoplay) {
            swiperInstance.autoplay.start();
        }
    }

    function pause(): void {
        if (swiperInstance.autoplay) {
            swiperInstance.autoplay.stop();
        }
    }

    function playPause(): void {
        const paused = !(dialog.querySelector('.btnSlideshowPause .material-icons') as HTMLElement).classList.contains('pause');
        if (paused) {
            play();
        } else {
            pause();
        }
    }

    function onDialogClosed(): void {
        fullscreenExit();

        const swiper = swiperInstance;
        if (swiper) {
            swiper.destroy(true, true);
            swiperInstance = null;
        }

        inputManager.off(window, onInputCommand);
        document.removeEventListener((window.PointerEvent ? 'pointermove' : 'mousemove') as string, onPointerMove as EventListener);
    }

    function showOsd(): void {
        const bottom = dialog.querySelector('.slideshowBottomBar');
        if (bottom) {
            slideToShow(bottom as HTMLElement, 'down');
        }

        const topActionButtons = dialog.querySelector('.topActionButtons');
        if (topActionButtons) slideToShow(topActionButtons as HTMLElement, 'up');

        const left = dialog.querySelector('.btnSlideshowPrevious');
        if (left) slideToShow(left as HTMLElement, 'left');

        const right = dialog.querySelector('.btnSlideshowNext');
        if (right) slideToShow(right as HTMLElement, 'right');

        startHideTimer();
    }

    function hideOsd(): void {
        const bottom = dialog.querySelector('.slideshowBottomBar');
        if (bottom) {
            slideToHide(bottom as HTMLElement, 'down');
        }

        const topActionButtons = dialog.querySelector('.topActionButtons');
        if (topActionButtons) slideToHide(topActionButtons as HTMLElement, 'up');

        const left = dialog.querySelector('.btnSlideshowPrevious');
        if (left) slideToHide(left as HTMLElement, 'left');

        const right = dialog.querySelector('.btnSlideshowNext');
        if (right) slideToHide(right as HTMLElement, 'right');
    }

    function startHideTimer(): void {
        stopHideTimer();
        hideTimeout = setTimeout(hideOsd, 3000);
    }

    function stopHideTimer(): void {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    }

    function keyframesSlide(hiddenPosition: string, fadingOut: boolean, element: HTMLElement): any[] {
        const visible = { transform: 'translate(0,0)', opacity: '1' };
        const invisible: Record<string, string> = { opacity: '.3' };

        if (hiddenPosition === 'up' || hiddenPosition === 'down') {
            invisible['transform'] = 'translate3d(0,' + element.offsetHeight * (hiddenPosition === 'down' ? 1 : -1) + 'px,0)';
        } else if (hiddenPosition === 'left' || hiddenPosition === 'right') {
            invisible['transform'] = 'translate3d(' + element.offsetWidth * (hiddenPosition === 'right' ? 1 : -1) + 'px,0,0)';
        }

        return fadingOut ? [visible, invisible] : [invisible, visible];
    }

    function slideToShow(element: HTMLElement, slideFrom: string): void {
        if (!element.classList.contains('hide')) {
            return;
        }

        element.classList.remove('hide');

        const onFinish = function () {
            const btnSlideshowPause = element.querySelector('.btnSlideshowPause');
            if (btnSlideshowPause) focusManager.focus(btnSlideshowPause);
        };

        if (!element.animate) {
            onFinish();
            return;
        }

        requestAnimationFrame(function () {
            const keyframes = keyframesSlide(slideFrom, false, element);
            const timing = { duration: 300, iterations: 1, easing: 'ease-out' };
            element.animate(keyframes, timing).onfinish = onFinish;
        });
    }

    function slideToHide(element: HTMLElement, slideInto: string): void {
        if (element.classList.contains('hide')) {
            return;
        }

        const onFinish = function () {
            element.classList.add('hide');
        };

        if (!element.animate) {
            onFinish();
            return;
        }

        requestAnimationFrame(function () {
            const keyframes = keyframesSlide(slideInto, true, element);
            const timing = { duration: 300, iterations: 1, easing: 'ease-out' };
            element.animate(keyframes, timing).onfinish = onFinish;
        });
    }

    function onPointerMove(event: any): void {
        const pointerType = event.pointerType || (layoutManager.mobile ? 'touch' : 'mouse');

        if (pointerType === 'mouse') {
            const eventX = event.screenX || 0;
            const eventY = event.screenY || 0;

            const obj = lastMouseMoveData;
            if (!obj) {
                lastMouseMoveData = {
                    x: eventX,
                    y: eventY
                };
                return;
            }

            if (Math.abs(eventX - obj.x) < 10 && Math.abs(eventY - obj.y) < 10) {
                return;
            }

            obj.x = eventX;
            obj.y = eventY;
        }
        showOsd();
    }

    function onInputCommand(event: any): void {
        switch (event.detail.command) {
            case 'up':
            case 'down':
            case 'select':
            case 'menu':
            case 'info':
                showOsd();
                break;
            case 'play':
                play();
                break;
            case 'pause':
                pause();
                break;
            case 'playpause':
                playPause();
                break;
            default:
                break;
        }
    }

    function getClickHandler(callback: ((e: Event) => void) | null): (e: Event) => void {
        return (e: Event) => {
            showOsd();
            callback?.(e);
        };
    }

    self.show = function (): void {
        createElements(options);
    };

    self.hide = function (): void {
        if (dialog) {
            dialogHelper.close(dialog);
        }
    };
}
