
/**
 * Useful DOM utilities.
 */

/**
 * Returns parent of element with specified attribute value.
 */
export function parentWithAttribute(elem: HTMLElement, name: string, value?: string): HTMLElement | null {
    while ((value ? elem.getAttribute(name) !== value : !elem.getAttribute(name))) {
        elem = elem.parentNode as HTMLElement;

        if (!elem?.getAttribute) {
            return null;
        }
    }

    return elem;
}

/**
 * Returns parent of element with one of specified tag names.
 */
export function parentWithTag(elem: HTMLElement, tagNames: string | string[]): HTMLElement | null {
    const names: string[] = Array.isArray(tagNames) ? tagNames : [tagNames];

    while (names.indexOf(elem.tagName || '') === -1) {
        elem = elem.parentNode as HTMLElement;

        if (!elem) {
            return null;
        }
    }

    return elem;
}

/**
 * Returns _true_ if class list contains one of specified names.
 */
function containsAnyClass(classList: DOMTokenList, classNames: string[]): boolean {
    for (let i = 0, length = classNames.length; i < length; i++) {
        if (classList.contains(classNames[i])) {
            return true;
        }
    }
    return false;
}

/**
 * Returns parent of element with one of specified class names.
 */
export function parentWithClass(elem: HTMLElement, classNames: string | string[]): HTMLElement | null {
    const names: string[] = Array.isArray(classNames) ? classNames : [classNames];

    while (!elem.classList || !containsAnyClass(elem.classList, names)) {
        elem = elem.parentNode as HTMLElement;

        if (!elem) {
            return null;
        }
    }

    return elem;
}

let supportsCaptureOption = false;
try {
    const opts = Object.defineProperty({}, 'capture', {
        get: function () {
            supportsCaptureOption = true;
            return null;
        }
    });
    window.addEventListener('test', null as unknown as EventListener, opts);
} catch {
    // no capture support
}

/**
 * Adds event listener to specified target.
 */
export function addEventListener(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void {
    let optionsOrCapture: AddEventListenerOptions | boolean | undefined = options || {};
    if (!supportsCaptureOption) {
        optionsOrCapture = (optionsOrCapture as AddEventListenerOptions).capture;
    }
    target.addEventListener(type, handler, optionsOrCapture);
}

/**
 * Removes event listener from specified target.
 */
export function removeEventListener(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void {
    let optionsOrCapture: AddEventListenerOptions | boolean | undefined = options || {};
    if (!supportsCaptureOption) {
        optionsOrCapture = (optionsOrCapture as AddEventListenerOptions).capture;
    }
    target.removeEventListener(type, handler, optionsOrCapture);
}

/**
 * Cached window size.
 */
let windowSize: { innerWidth: number; innerHeight: number } | null = null;

/**
 * Flag of event listener bound.
 */
let windowSizeEventsBound: boolean;

/**
 * Resets cached window size.
 */
function clearWindowSize(): void {
    windowSize = null;
}

/**
 * Returns window size.
 */
export function getWindowSize(): { innerWidth: number; innerHeight: number } {
    if (!windowSize) {
        const innerWidth = window.innerWidth;
        const innerHeight = window.innerHeight;

        // NOTE: webOS has a bug that reports window size as infinite on page load, so we use a fallback size of 4K
        if (!Number.isFinite(innerWidth) || !Number.isFinite(innerHeight)) {
            return {
                innerWidth: Number.isFinite(innerWidth) ? innerWidth : 3840,
                innerHeight: Number.isFinite(innerHeight) ? innerHeight : 2160
            };
        }

        windowSize = {
            innerWidth,
            innerHeight
        };

        if (!windowSizeEventsBound) {
            windowSizeEventsBound = true;
            addEventListener(window, 'orientationchange', clearWindowSize, { passive: true });
            addEventListener(window, 'resize', clearWindowSize, { passive: true });
        }
    }

    return windowSize;
}

/**
 * Standard screen widths.
 */
const standardWidths = [480, 720, 1280, 1440, 1920, 2560, 3840, 5120, 7680];

/**
 * Returns screen width.
 */
export function getScreenWidth(): number {
    let width = Number.isFinite(window.innerWidth) ? window.innerWidth : 3840;
    const height = Number.isFinite(window.innerHeight) ? window.innerHeight : 2160;

    if (height > width) {
        width = height * (16.0 / 9.0);
    }

    standardWidths.sort((a, b) => Math.abs(width - a) - Math.abs(width - b));

    return standardWidths[0];
}

/**
 * Name of animation end event.
 */
let _animationEvent: string;

/**
 * Returns name of animation end event.
 */
export function whichAnimationEvent(): string {
    if (_animationEvent) {
        return _animationEvent;
    }

    const el = document.createElement('div');
    const animations: Record<string, string> = {
        'animation': 'animationend',
        'OAnimation': 'oAnimationEnd',
        'MozAnimation': 'animationend',
        'WebkitAnimation': 'webkitAnimationEnd'
    };
    for (const t in animations) {
        if ((el.style as unknown as Record<string, unknown>)[t] !== undefined) {
            _animationEvent = animations[t];
            return animations[t];
        }
    }

    _animationEvent = 'animationend';
    return _animationEvent;
}

/**
 * Returns name of animation cancel event.
 */
export function whichAnimationCancelEvent(): string {
    return whichAnimationEvent().replace('animationend', 'animationcancel').replace('AnimationEnd', 'AnimationCancel');
}

/**
 * Name of transition end event.
 */
let _transitionEvent: string;

/**
 * Returns name of transition end event.
 */
export function whichTransitionEvent(): string {
    if (_transitionEvent) {
        return _transitionEvent;
    }

    const el = document.createElement('div');
    const transitions: Record<string, string> = {
        'transition': 'transitionend',
        'OTransition': 'oTransitionEnd',
        'MozTransition': 'transitionend',
        'WebkitTransition': 'webkitTransitionEnd'
    };
    for (const t in transitions) {
        if ((el.style as unknown as Record<string, unknown>)[t] !== undefined) {
            _transitionEvent = transitions[t];
            return transitions[t];
        }
    }

    _transitionEvent = 'transitionend';
    return _transitionEvent;
}

/**
 * Sets title and ARIA-label of element.
 */
export function setElementTitle(elem: HTMLElement, title: string, ariaLabel?: string | null): void {
    elem.setAttribute('title', title);
    elem.setAttribute('aria-label', ariaLabel as string);
}

export default {
    parentWithAttribute,
    parentWithClass,
    parentWithTag,
    addEventListener,
    removeEventListener,
    getWindowSize,
    getScreenWidth,
    setElementTitle,
    whichTransitionEvent,
    whichAnimationEvent,
    whichAnimationCancelEvent
};
