import isEqual from 'lodash-es/isEqual';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import browser from '../../scripts/browser';
import { playbackManager } from '../playback/playbackmanager';
import dom from '../../utils/dom';
import * as userSettings from '../../scripts/settings/userSettings';

import './backdrop.scss';

function enableAnimation(): boolean {
    return !browser.slow;
}

function enableRotation(): boolean {
    return !browser.tv;
}

class Backdrop {
    isDestroyed: boolean = false;
    currentAnimatingElement: HTMLElement | null = null;

    load(url: string, parent: HTMLElement): void {
        const img = new Image();
        const self = this;

        img.onload = () => {
            if (self.isDestroyed) {
                return;
            }

            const backdropImage = document.createElement('div');
            backdropImage.classList.add('backdropImage');
            backdropImage.classList.add('displayingBackdropImage');
            backdropImage.style.backgroundImage = `url('${url}')`;
            backdropImage.setAttribute('data-url', url);

            backdropImage.classList.add('backdropImageFadeIn');
            parent.appendChild(backdropImage);

            if (!enableAnimation()) {
                internalBackdrop(true);
                return;
            }

            const onAnimationComplete = (): void => {
                dom.removeEventListener(backdropImage, dom.whichAnimationEvent(), onAnimationComplete, {
                    once: true
                });
                if (backdropImage === self.currentAnimatingElement) {
                    self.currentAnimatingElement = null;
                }
            };

            dom.addEventListener(backdropImage, dom.whichAnimationEvent(), onAnimationComplete, {
                once: true
            });

            internalBackdrop(true);
        };

        img.src = url;
    }

    cancelAnimation(): void {
        const elem = this.currentAnimatingElement;
        if (elem) {
            elem.classList.remove('backdropImageFadeIn');
            this.currentAnimatingElement = null;
        }
    }

    destroy(): void {
        this.isDestroyed = true;
        this.cancelAnimation();
    }
}

let backdropContainer: HTMLElement | null;
function getBackdropContainer(): HTMLElement {
    if (!backdropContainer) {
        backdropContainer = document.querySelector('.backdropContainer');
    }

    if (!backdropContainer) {
        backdropContainer = document.createElement('div');
        backdropContainer.classList.add('backdropContainer');
        document.body.insertBefore(backdropContainer, document.body.firstChild);
    }

    return backdropContainer;
}

export function clearBackdrop(clearAll?: boolean): void {
    clearRotation();

    if (currentLoadingBackdrop) {
        currentLoadingBackdrop.destroy();
        currentLoadingBackdrop = null;
    }

    const elem = getBackdropContainer();
    elem.innerHTML = '';

    if (clearAll) {
        hasExternalBackdrop = false;
    }

    internalBackdrop(false);
}

let backgroundContainer: HTMLElement | null;
function getBackgroundContainer(): HTMLElement {
    if (!backgroundContainer) {
        backgroundContainer = document.querySelector('.backgroundContainer');
    }
    return backgroundContainer!;
}

function setBackgroundContainerBackgroundEnabled(): void {
    if (hasInternalBackdrop || hasExternalBackdrop) {
        getBackgroundContainer().classList.add('withBackdrop');
    } else {
        getBackgroundContainer().classList.remove('withBackdrop');
    }
}

let hasInternalBackdrop: boolean;
function internalBackdrop(isEnabled: boolean): void {
    hasInternalBackdrop = isEnabled;
    setBackgroundContainerBackgroundEnabled();
}

let hasExternalBackdrop: boolean;
export function externalBackdrop(isEnabled: boolean): void {
    hasExternalBackdrop = isEnabled;
    setBackgroundContainerBackgroundEnabled();
}

let currentLoadingBackdrop: Backdrop | null;
function setBackdropImage(url: string): void {
    if (currentLoadingBackdrop) {
        currentLoadingBackdrop.destroy();
        currentLoadingBackdrop = null;
    }

    const elem = getBackdropContainer();
    const existingBackdropImage = elem.querySelector('.displayingBackdropImage');
    // If the current backdrop image is the same as the new one, do nothing
    if (existingBackdropImage && existingBackdropImage.getAttribute('data-url') === url) {
        return;
    }

    const instance = new Backdrop();
    instance.load(url, elem);
    currentLoadingBackdrop = instance;
}

function getItemImageUrls(item: any, imageOptions?: any): string[] {
    imageOptions = imageOptions || {};

    const apiClient: any = ServerConnections.getApiClient(item.ServerId);
    if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
        return item.BackdropImageTags.map((imgTag: string, index: number) => {
            return apiClient.getScaledImageUrl(item.BackdropItemId || item.Id, Object.assign(imageOptions, {
                type: 'Backdrop',
                tag: imgTag,
                maxWidth: dom.getScreenWidth(),
                index: index
            }));
        });
    }

    if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) {
        return item.ParentBackdropImageTags.map((imgTag: string, index: number) => {
            return apiClient.getScaledImageUrl(item.ParentBackdropItemId, Object.assign(imageOptions, {
                type: 'Backdrop',
                tag: imgTag,
                maxWidth: dom.getScreenWidth(),
                index: index
            }));
        });
    }

    return [];
}

function getImageUrls(items: any[], imageOptions?: any): string[] {
    const list: string[] = [];
    const onImg = (img: string) => {
        list.push(img);
    };

    for (let i = 0, length = items.length; i < length; i++) {
        const itemImages = getItemImageUrls(items[i], imageOptions);
        itemImages.forEach(onImg);
    }

    return list;
}

function enabled(): boolean {
    return userSettings.enableBackdrops();
}

let rotationInterval: ReturnType<typeof setInterval> | null;
let currentRotatingImages: string[] = [];
let currentRotationIndex = -1;
export function setBackdrops(items: any[], imageOptions?: any, isEnabled = false): void {
    if (isEnabled || enabled()) {
        const images = getImageUrls(items, imageOptions);

        if (images.length) {
            setBackdropImages(images);
        } else {
            clearBackdrop();
        }
    }
}

export function setBackdropImages(images: string[]): void {
    if (isEqual(images, currentRotatingImages)) {
        return;
    }

    clearRotation();

    currentRotatingImages = images;
    currentRotationIndex = -1;

    if (images.length > 1 && enableRotation()) {
        rotationInterval = setInterval(onRotationInterval, 10000);
    }

    onRotationInterval();
}

function onRotationInterval(): void {
    if (playbackManager.isPlayingLocally(['Video'])) {
        return;
    }

    let newIndex = currentRotationIndex + 1;
    if (newIndex >= currentRotatingImages.length) {
        newIndex = 0;
    }

    currentRotationIndex = newIndex;
    const currentImage = currentRotatingImages[newIndex];
    setBackdropImage(currentImage);

    // Remove old images after a delay to allow fade-in animation (800ms) to complete
    setTimeout(() => {
        const oldImages = getBackdropContainer().querySelectorAll(`.backdropImage:not([data-url="${currentImage}"])`);
        oldImages.forEach(img => {
            img.remove();
        });
    }, 1600);
}

function clearRotation(): void {
    const interval = rotationInterval;
    if (interval) {
        clearInterval(interval);
    }

    rotationInterval = null;
    currentRotatingImages = [];
    currentRotationIndex = -1;
}

export function setBackdrop(url: string | any, imageOptions?: any): void {
    if (url && typeof url !== 'string') {
        url = getImageUrls([url], imageOptions)[0];
    }

    if (url) {
        clearRotation();
        setBackdropImage(url as string);
    } else {
        clearBackdrop();
    }
}

/**
 * @enum TransparencyLevel
 */
export const TRANSPARENCY_LEVEL = {
    Full: 'full',
    Backdrop: 'backdrop',
    None: 'none'
} as const;

export type TransparencyLevel = typeof TRANSPARENCY_LEVEL[keyof typeof TRANSPARENCY_LEVEL];

/**
 * Sets the backdrop, background, and document transparency
 * @param {TransparencyLevel} level The level of transparency
 */
export function setBackdropTransparency(level: TransparencyLevel | number): void {
    const backdropElem = getBackdropContainer();
    const backgroundElem = getBackgroundContainer();

    if (level === TRANSPARENCY_LEVEL.Full || level === 2) {
        clearBackdrop(true);
        document.documentElement.classList.add('transparentDocument');
        backgroundElem.classList.add('backgroundContainer-transparent');
        backdropElem.classList.add('hide');
    } else if (level === TRANSPARENCY_LEVEL.Backdrop || level === 1) {
        externalBackdrop(true);
        document.documentElement.classList.add('transparentDocument');
        backgroundElem.classList.add('backgroundContainer-transparent');
        backdropElem.classList.add('hide');
    } else {
        externalBackdrop(false);
        document.documentElement.classList.remove('transparentDocument');
        backgroundElem.classList.remove('backgroundContainer-transparent');
        backdropElem.classList.remove('hide');
    }
}
