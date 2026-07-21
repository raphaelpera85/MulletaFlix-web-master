/**
 * NOTE: This file should not be modified.
 * It is a legacy library that should be replaced at some point.
 */

import browser from '../../scripts/browser';
import layoutManager from '../../components/layoutManager';
import dom from '../../utils/dom';
import focusManager from '../../components/focusManager';
import '../../styles/scrollstyles.scss';
import globalize from '../globalize';

/**
* Return type of the value.
*
* @param  {Mixed} value
*
* @return {String}
*/
function type(value: unknown): string {
    if (value == null) {
        return String(value);
    }

    if (typeof value === 'object' || typeof value === 'function') {
        // eslint-disable-next-line sonarjs/prefer-regexp-exec
        return Object.prototype.toString.call(value).match(/\s([a-z]+)/i)![1].toLowerCase() || 'object';
    }

    return typeof value;
}

/**
 * Disables an event it was triggered on and unbinds itself.
 *
 * @param  {Event} event
 *
 * @return {Void}
 */
function disableOneEvent(this: EventTarget, event: Event): void {
    /*jshint validthis:true */
    event.preventDefault();
    event.stopPropagation();
    this.removeEventListener(event.type, disableOneEvent as EventListener);
}

/**
 * Make sure that number is within the limits.
 *
 * @param {Number} number
 * @param {Number} min
 * @param {Number} max
 *
 * @return {Number}
 */
function within(number: number, num1: number, num2?: number): number {
    if (num2 === undefined && globalize.getIsRTL()) {
        return number > num1 ? num1 : number;
    } else if (num2 === undefined) {
        return number < num1 ? num1 : number;
    }
    const min = Math.min(num1, num2);
    const max = Math.max(num1, num2);
    if (number < min) {
        return min;
    } else if (number > max) {
        return max;
    }
    return number;
}

// Other global values
const dragMouseEvents: string[] = ['mousemove', 'mouseup'];
const dragTouchEvents: string[] = ['touchmove', 'touchend'];
const wheelEvent: string = (document.implementation.hasFeature('Event.wheel', '3.0') ? 'wheel' : 'mousewheel');
const interactiveElements: string[] = ['INPUT', 'SELECT', 'TEXTAREA'];

interface ScrollerOptions {
    slidee?: HTMLElement | null;
    horizontal?: boolean;
    mouseWheel?: boolean;
    scrollBy?: number;
    dragSource?: HTMLElement | null;
    mouseDragging?: number;
    touchDragging?: number;
    dragThreshold?: number;
    intervactive?: string | null;
    speed?: number;
    allowNativeScroll?: boolean;
    enableNativeScroll?: boolean;
    allowNativeSmoothScroll?: boolean;
    requireAnimation?: boolean;
    hideScrollbar?: boolean;
    forceHideScrollbars?: boolean;
    autoImmediate?: boolean;
    skipSlideToWhenVisible?: boolean;
    immediateSpeed?: number;
    dispatchScrollEvent?: boolean;
    scrollWidth?: number;
    centerOffset?: number;
    [key: string]: unknown;
}

interface ScrollerPos {
    start: number;
    center: number;
    end: number;
    cur: number;
    dest: number;
}

interface DraggingState {
    released: number | boolean;
    init?: number;
    source?: EventTarget;
    touch?: boolean;
    initX?: number;
    initY?: number;
    initPos?: number;
    start?: number;
    time?: number;
    path?: number;
    delta?: number;
    locked?: number;
    pathToLock?: number;
    pathX?: number;
    pathY?: number;
}

interface ItemPos {
    start: number;
    center: number;
    end: number;
    size: number;
    isVisible: boolean;
}

interface ScrollableElement {
    scroll(options?: ScrollToOptions): void;
    scrollTo?(x: number, y: number): void;
    scrollLeft: number;
    scrollTop: number;
    scrollWidth: number;
    scrollHeight: number;
}

const scrollerFactory = function (this: ScrollerInstance, frame: HTMLElement, options?: ScrollerOptions) {
    // Extend options
    const o: ScrollerOptions = Object.assign({}, {
        slidee: null, // Selector, DOM element, or jQuery object with DOM element representing SLIDEE.
        horizontal: false, // Switch to horizontal mode.

        // Scrolling
        mouseWheel: true,
        scrollBy: 0, // Pixels or items to move per one mouse scroll. 0 to disable scrolling

        // Dragging
        dragSource: null, // Selector or DOM element for catching dragging events. Default is FRAME.
        mouseDragging: 1, // Enable navigation by dragging the SLIDEE with mouse cursor.
        touchDragging: 1, // Enable navigation by dragging the SLIDEE with touch events.
        dragThreshold: 3, // Distance in pixels before Sly recognizes dragging.
        intervactive: null, // Selector for special interactive elements.

        // Mixed options
        speed: 0 // Animations speed in milliseconds. 0 to disable animations.

    }, options) as ScrollerOptions;

    const isSmoothScrollSupported = 'scrollBehavior' in document.documentElement.style;

    // native scroll is a must with touch input
    // also use native scroll when scrolling vertically in desktop mode - excluding horizontal because the mouse wheel support is choppy at the moment
    // in cases with firefox, if the smooth scroll api is supported then use that because their implementation is very good
    if (options?.allowNativeScroll === false) {
        options.enableNativeScroll = false;
    } else if (isSmoothScrollSupported && ((browser.firefox && !layoutManager.tv) || options?.allowNativeSmoothScroll)) {
        // native smooth scroll
        (options as ScrollerOptions).enableNativeScroll = true;
    } else if (options?.requireAnimation && (browser.animate || browser.supportsCssAnimation())) {
        // transform is the only way to guarantee animation
        (options as ScrollerOptions).enableNativeScroll = false;
    } else if (!layoutManager.tv || !browser.animate) {
        (options as ScrollerOptions).enableNativeScroll = true;
    }

    // Need this for the magic wheel. With the animated scroll the magic wheel will run off of the screen
    if (browser.web0s) {
        (options as ScrollerOptions).enableNativeScroll = true;
    }

    // Private variables
    const self = this;
    self.options = o;

    // Frame
    const slideeElement: HTMLElement = o.slidee ? o.slidee : (sibling(frame.firstChild as ChildNode)[0] as HTMLElement);
    self._pos = {
        start: 0,
        center: 0,
        end: 0,
        cur: 0,
        dest: 0
    } as ScrollerPos;

    const transform = !options?.enableNativeScroll;

    // Miscellaneous
    const scrollSource = frame;
    const dragSourceElement: HTMLElement = o.dragSource ? o.dragSource : frame;
    const dragging: DraggingState = {
        released: 1
    };
    const scrolling: { last: number; delta: number; resetTime: number; curDelta?: number } = {
        last: 0,
        delta: 0,
        resetTime: 200
    };

    // Expose properties
    self.initialized = 0;
    self.slidee = slideeElement;
    self.options = o;
    self.dragging = dragging;

    const nativeScrollElement = frame;

    function sibling(n: Node | null, elem?: Node): Node[] {
        const matched: Node[] = [];

        for (; n; n = n.nextSibling) {
            if ((n as Element).nodeType === 1 && n !== elem) {
                matched.push(n);
            }
        }
        return matched;
    }

    let requiresReflow = true;

    let frameSize = 0;
    let slideeSize = 0;
    function ensureSizeInfo(): void {
        if (requiresReflow) {
            requiresReflow = false;

            // Reset global variables
            frameSize = slideeElement[o.horizontal ? 'clientWidth' : 'clientHeight'];
            slideeSize = o.scrollWidth || Math.max(slideeElement[o.horizontal ? 'offsetWidth' : 'offsetHeight'], slideeElement[o.horizontal ? 'scrollWidth' : 'scrollHeight']);

            // Set position limits & relatives
            (self._pos as ScrollerPos).end = Math.max(slideeSize - frameSize, 0);
            if (globalize.getIsRTL()) {
                (self._pos as ScrollerPos).end *= -1;
            }
        }
    }

    /**
     * Loading function.
     *
     * Populate arrays, set sizes, bind events, ...
     *
     * @param {Boolean} [isInit] Whether load is called from within self.init().
     * @return {Void}
     */
    function load(isInit?: boolean): void {
        requiresReflow = true;

        if (!isInit) {
            ensureSizeInfo();

            // Fix possible overflowing
            const pos = self._pos as ScrollerPos;
            self.slideTo(within(pos.dest, pos.start, pos.end));
        }
    }

    function initFrameResizeObserver(): void {
        self.frameResizeObserver = new ResizeObserver(onResize);

        self.frameResizeObserver.observe(frame);
    }

    self.reload = function (): void {
        load();
    };

    self.getScrollEventName = function (): string {
        return transform ? 'scrollanimate' : 'scroll';
    };

    self.getScrollSlider = function (): HTMLElement {
        return slideeElement;
    };

    self.getScrollFrame = function (): HTMLElement {
        return frame;
    };

    function nativeScrollTo(container: HTMLElement, pos: number, immediate?: boolean): void {
        const scrollable = container as unknown as ScrollableElement;
        if (scrollable.scroll) {
            if (o.horizontal) {
                scrollable.scroll({
                    left: pos,
                    behavior: immediate ? 'instant' : 'smooth'
                });
            } else {
                scrollable.scroll({
                    top: pos,
                    behavior: immediate ? 'instant' : 'smooth'
                });
            }
        } else if (!immediate && scrollable.scrollTo) {
            if (o.horizontal) {
                scrollable.scrollTo(Math.round(pos), 0);
            } else {
                scrollable.scrollTo(0, Math.round(pos));
            }
        } else if (o.horizontal) {
            scrollable.scrollLeft = Math.round(pos);
        } else {
            scrollable.scrollTop = Math.round(pos);
        }
    }

    let lastAnimate: number | undefined;

    /**
         * Animate to a position.
         *
         * @param {Int}  newPos    New position.
         * @param {Bool} immediate Reposition immediately without an animation.
         *
         * @return {Void}
         */
    self.slideTo = function (newPos: number, immediate?: boolean, fullItemPos?: ItemPos): void {
        ensureSizeInfo();
        const pos = self._pos as ScrollerPos;

        if (layoutManager.tv && globalize.getIsRTL()) {
            newPos = within(-newPos, pos.start);
        } else if (layoutManager.tv) {
            newPos = within(newPos, pos.start);
        } else {
            newPos = within(newPos, pos.start, pos.end);
        }

        if (!transform) {
            nativeScrollTo(nativeScrollElement, newPos, immediate);
            return;
        }

        // Update the animation object
        const from = pos.cur;
        immediate = immediate || !!dragging.init || !o.speed;

        const now = new Date().getTime();

        if (o.autoImmediate && !immediate && (now - (lastAnimate || 0)) <= 50) {
            immediate = true;
        }

        if (!immediate && o.skipSlideToWhenVisible && fullItemPos?.isVisible) {
            return;
        }

        // Start animation rendering
        // NOTE the dependency was modified here to fix a scrollbutton issue
        pos.dest = newPos;
        renderAnimateWithTransform(from, newPos, immediate);
        lastAnimate = now;
    };

    function setStyleProperty(elem: HTMLElement, name: string, value: string, speed: number, resetTransition?: boolean): void {
        const style = elem.style;

        if (resetTransition || browser.edge) {
            style.transition = 'none';
            void elem.offsetWidth;
        }

        style.transition = 'transform ' + speed + 'ms ease-out';
        (style as unknown as Record<string, string>)[name] = value;
    }

    function dispatchScrollEventIfNeeded(): void {
        if (o.dispatchScrollEvent) {
            frame.dispatchEvent(new CustomEvent(self.getScrollEventName(), {
                bubbles: true,
                cancelable: false
            }));
        }
    }

    function renderAnimateWithTransform(fromPosition: number, toPosition: number, immediate?: boolean): void {
        let speed = o.speed || 0;

        if (immediate) {
            speed = o.immediateSpeed || 50;
        }

        if (o.horizontal) {
            setStyleProperty(slideeElement, 'transform', 'translateX(' + (-Math.round(toPosition)) + 'px)', speed);
        } else {
            setStyleProperty(slideeElement, 'transform', 'translateY(' + (-Math.round(toPosition)) + 'px)', speed);
        }
        (self._pos as ScrollerPos).cur = toPosition;

        dispatchScrollEventIfNeeded();
    }

    function getBoundingClientRect(elem: HTMLElement): DOMRect | { top: number; left: number; right?: number; width?: number; height?: number } {
        // Support: BlackBerry 5, iOS 3 (original iPhone)
        // If we don't have gBCR, just use 0,0 rather than error
        if (elem.getBoundingClientRect) {
            return elem.getBoundingClientRect();
        } else {
            return { top: 0, left: 0 };
        }
    }

    /**
     * Returns the position object.
     *
     * @param {Mixed} item
     *
     * @return {Object}
     */
    self.getPos = function (item: HTMLElement): ItemPos {
        const scrollElement = transform ? slideeElement : nativeScrollElement;
        const slideeOffset = getBoundingClientRect(scrollElement);
        const itemOffset = getBoundingClientRect(item);

        let horizontalOffset = itemOffset.left - slideeOffset.left;
        if (globalize.getIsRTL()) {
            horizontalOffset = (slideeOffset as DOMRect).right - (itemOffset as DOMRect).right;
        }

        let offset = o.horizontal ? horizontalOffset : itemOffset.top - slideeOffset.top;

        let size = o.horizontal ? (itemOffset as DOMRect).width || 0 : (itemOffset as DOMRect).height || 0;
        if (!size && size !== 0) {
            size = item[o.horizontal ? 'offsetWidth' : 'offsetHeight'];
        }

        let centerOffset = o.centerOffset || 0;

        if (!transform) {
            centerOffset = 0;
            if (o.horizontal) {
                offset += nativeScrollElement.scrollLeft;
            } else {
                offset += nativeScrollElement.scrollTop;
            }
        }

        ensureSizeInfo();

        const currentStart = (self._pos as ScrollerPos).cur;
        let currentEnd = currentStart + frameSize;
        if (globalize.getIsRTL()) {
            currentEnd = currentStart - frameSize;
        }

        console.debug('offset:' + offset + ' currentStart:' + currentStart + ' currentEnd:' + currentEnd);
        const isVisible = offset >= Math.min(currentStart, currentEnd)
            && (globalize.getIsRTL() ? (offset - size) : (offset + size)) <= Math.max(currentStart, currentEnd);

        return {
            start: offset,
            center: offset + centerOffset - (frameSize / 2) + (size / 2),
            end: offset - frameSize + size,
            size,
            isVisible
        };
    };

    self.getCenterPosition = function (item: HTMLElement): number {
        ensureSizeInfo();

        const pos = self.getPos(item);
        return within(pos.center, pos.start, pos.end);
    };

    function dragInitSlidee(event: MouseEvent | TouchEvent): void {
        const isTouch = event.type === 'touchstart';

        // Ignore when already in progress, or interactive element in non-touch navivagion
        if (dragging.init || !isTouch && isInteractive(event.target as Element)) {
            return;
        }

        // SLIDEE dragging conditions
        if (!(isTouch ? o.touchDragging : o.mouseDragging && (event as MouseEvent).which < 2)) {
            return;
        }

        if (!isTouch) {
            // prevents native image dragging in Firefox
            event.preventDefault();
        }

        // Reset dragging object
        dragging.released = 0;

        // Properties used in dragHandler
        dragging.init = 0;
        dragging.source = event.target as EventTarget;
        dragging.touch = isTouch;
        const pointer = isTouch ? (event as TouchEvent).touches[0] : event as MouseEvent;
        dragging.initX = pointer.pageX;
        dragging.initY = pointer.pageY;
        dragging.initPos = (self._pos as ScrollerPos).cur;
        dragging.start = +new Date();
        dragging.time = 0;
        dragging.path = 0;
        dragging.delta = 0;
        dragging.locked = 0;
        dragging.pathToLock = isTouch ? 30 : 10;

        // Bind dragging events
        if (transform) {
            if (isTouch) {
                dragTouchEvents.forEach(function (eventName: string) {
                    dom.addEventListener(document, eventName, dragHandler as EventListener, {
                        passive: true
                    });
                });
            } else {
                dragMouseEvents.forEach(function (eventName: string) {
                    dom.addEventListener(document, eventName, dragHandler as EventListener, {
                        passive: true
                    });
                });
            }
        }
    }

    /**
     * Handler for dragging scrollbar handle or SLIDEE.
     *
     * @param  {Event} event
     *
     * @return {Void}
     */
    function dragHandler(event: MouseEvent | TouchEvent): void {
        dragging.released = event.type === 'mouseup' || event.type === 'touchend';
        const eventName = dragging.released ? 'changedTouches' : 'touches';
        const pointer = dragging.touch ? (event as TouchEvent)[eventName as keyof TouchEvent] as unknown as TouchList : undefined;
        const pointerEvent = pointer ? pointer[0] : event as MouseEvent;
        dragging.pathX = pointerEvent.pageX - (dragging.initX || 0);
        dragging.pathY = pointerEvent.pageY - (dragging.initY || 0);
        dragging.path = Math.sqrt(Math.pow(dragging.pathX, 2) + Math.pow(dragging.pathY, 2));
        dragging.delta = o.horizontal ? dragging.pathX : dragging.pathY;

        if (!dragging.released && (dragging.path || 0) < 1) {
            return;
        }

        // We haven't decided whether this is a drag or not...
        if (!dragging.init) {
            // If the drag path was very short, maybe it's not a drag?
            if ((dragging.path || 0) < (o.dragThreshold || 0)) {
                // If the pointer was released, the path will not become longer and it's
                // definitely not a drag. If not released yet, decide on next iteration
                return dragging.released ? dragEnd() : undefined;
            } else if (o.horizontal ? Math.abs(dragging.pathX || 0) > Math.abs(dragging.pathY || 0) : Math.abs(dragging.pathX || 0) < Math.abs(dragging.pathY || 0)) {
                // If dragging path is sufficiently long we can confidently start a drag
                // if drag is in different direction than scroll, ignore it
                dragging.init = 1;
            } else {
                return dragEnd();
            }
        }

        // Disable click on a source element, as it is unwelcome when dragging
        if (!dragging.locked && (dragging.path || 0) > (dragging.pathToLock || 0)) {
            dragging.locked = 1;
            dragging.source!.addEventListener('click', disableOneEvent as EventListener);
        }

        // Cancel dragging on release
        if (dragging.released) {
            dragEnd();
        }

        self.slideTo(Math.round((dragging.initPos || 0) - (dragging.delta || 0)));
    }

    /**
     * Stops dragging and cleans up after it.
     *
     * @return {Void}
     */
    function dragEnd(): void {
        dragging.released = true;

        dragTouchEvents.forEach(function (eventName: string) {
            dom.removeEventListener(document, eventName, dragHandler as EventListener, {
                passive: true
            });
        });

        dragMouseEvents.forEach(function (eventName: string) {
            dom.removeEventListener(document, eventName, dragHandler as EventListener, {
                passive: true
            });
        });

        // Make sure that disableOneEvent is not active in next tick.
        setTimeout(function () {
            dragging.source!.removeEventListener('click', disableOneEvent as EventListener);
        });

        dragging.init = 0;
    }

    /**
     * Check whether element is interactive.
     *
     * @return {Boolean}
     */
    function isInteractive(element: Element | null): boolean {
        let current: ParentNode | null = element;
        while (current) {
            if (current.nodeType === 1 && interactiveElements.indexOf((current as Element).tagName) !== -1) {
                return true;
            }

            current = current.parentNode;
        }
        return false;
    }

    /**
     * Mouse wheel delta normalization.
     *
     * @param  {Event} event
     *
     * @return {Int}
     */
    function normalizeWheelDelta(event: WheelEvent): number {
        // MulletaFlix MOD: Only use deltaX for horizontal scroll and remove IE8 support
        scrolling.curDelta = o.horizontal ? event.deltaX : event.deltaY;
        // END MulletaFlix MOD

        if (transform) {
            scrolling.curDelta /= event.deltaMode === 1 ? 3 : 100;
        }
        return scrolling.curDelta;
    }

    /**
     * Mouse scrolling handler.
     *
     * @param  {Event} event
     *
     * @return {Void}
     */
    function scrollHandler(event: WheelEvent): void {
        ensureSizeInfo();
        const pos = self._pos as ScrollerPos;
        // Ignore if there is no scrolling to be done
        if (!o.scrollBy || pos.start === pos.end) {
            return;
        }
        let delta = normalizeWheelDelta(event);

        if (transform) {
            if (o.horizontal && event.deltaX !== 0
                && (event.deltaY >= -5 && event.deltaY <= 5)
                && (pos.dest + (o.scrollBy || 0) * delta > 0)
                && (pos.dest + (o.scrollBy || 0) * delta < pos.end)
            ) {
                event.preventDefault();
            }
            self.slideBy((o.scrollBy || 0) * delta);
        } else {
            if (isSmoothScrollSupported) {
                delta *= 12;
            }

            if (o.horizontal) {
                nativeScrollElement.scrollLeft += delta;
            } else {
                nativeScrollElement.scrollTop += delta;
            }
        }
    }

    /**
     * Destroys instance and everything it created.
     *
     * @return {Void}
     */
    self.destroy = function (): typeof self {
        if (self.frameResizeObserver) {
            self.frameResizeObserver.disconnect();
            self.frameResizeObserver = null;
        }

        // Reset native FRAME element scroll
        dom.removeEventListener(frame, 'scroll', resetScroll as EventListener, {
            passive: true
        });

        dom.removeEventListener(scrollSource, wheelEvent, scrollHandler as EventListener, {
            passive: false
        });

        dom.removeEventListener(dragSourceElement, 'touchstart', dragInitSlidee as EventListener, {
            passive: true
        });

        dom.removeEventListener(frame, 'click', onFrameClick as EventListener, {
            passive: true,
            capture: true
        });

        dom.removeEventListener(dragSourceElement, 'mousedown', dragInitSlidee as EventListener, {
            //passive: true
        });

        scrollSource.removeAttribute(`data-scroll-mode-${o.horizontal ? 'x' : 'y'}`);

        // Reset initialized status and return the instance
        self.initialized = 0;
        return self;
    };

    let contentRect: { width?: number; height?: number } = {};

    function onResize(entries: ResizeObserverEntry[]): void {
        const entry = entries[0];

        if (entry) {
            const newRect = entry.contentRect;

            // handle element being hidden
            if (newRect.width === 0 || newRect.height === 0) {
                return;
            }

            if (newRect.width !== contentRect.width || newRect.height !== contentRect.height) {
                contentRect = newRect;

                load(false);
            }
        }
    }

    function resetScroll(this: HTMLElement): void {
        if (o.horizontal) {
            this.scrollLeft = 0;
        } else {
            this.scrollTop = 0;
        }
    }

    function onFrameClick(e: MouseEvent): void {
        if (e.which === 1) {
            const focusableParent = focusManager.focusableParent(e.target as Element);
            if (focusableParent && focusableParent !== document.activeElement) {
                focusableParent.focus();
            }
        }
    }

    self.getScrollPosition = function (): number {
        if (transform) {
            return (self._pos as ScrollerPos).cur;
        }

        if (o.horizontal) {
            return nativeScrollElement.scrollLeft;
        } else {
            return nativeScrollElement.scrollTop;
        }
    };

    self.getScrollSize = function (): number {
        if (transform) {
            return slideeSize;
        }

        if (o.horizontal) {
            return nativeScrollElement.scrollWidth;
        } else {
            return nativeScrollElement.scrollHeight;
        }
    };

    /**
     * Initialize.
     *
     * @return {Object}
     */
    self.init = function (): ScrollerInstance | undefined {
        if (self.initialized) {
            return undefined;
        }

        if (!transform) {
            if (o.horizontal) {
                if (layoutManager.desktop && !o.hideScrollbar) {
                    nativeScrollElement.classList.add('scrollX');
                } else {
                    nativeScrollElement.classList.add('scrollX');
                    nativeScrollElement.classList.add('hiddenScrollX');

                    if (layoutManager.tv && o.allowNativeSmoothScroll !== false) {
                        nativeScrollElement.classList.add('smoothScrollX');
                    }
                }

                if (o.forceHideScrollbars) {
                    nativeScrollElement.classList.add('hiddenScrollX-forced');
                }
            } else {
                if (layoutManager.desktop && !o.hideScrollbar) {
                    nativeScrollElement.classList.add('scrollY');
                } else {
                    nativeScrollElement.classList.add('scrollY');
                    nativeScrollElement.classList.add('hiddenScrollY');

                    if (layoutManager.tv && o.allowNativeSmoothScroll !== false) {
                        nativeScrollElement.classList.add('smoothScrollY');
                    }
                }

                if (o.forceHideScrollbars) {
                    nativeScrollElement.classList.add('hiddenScrollY-forced');
                }
            }
        } else {
            if (layoutManager.tv) {
                frame.style.overflow = 'hidden';
            }

            slideeElement.style['will-change' as never] = 'transform';
            slideeElement.style.transition = 'transform ' + (o.speed || 0) + 'ms ease-out';

            if (o.horizontal) {
                slideeElement.classList.add('animatedScrollX');
            } else {
                slideeElement.classList.add('animatedScrollY');
            }
        }

        scrollSource.setAttribute(`data-scroll-mode-${o.horizontal ? 'x' : 'y'}`, 'custom');

        if (transform || layoutManager.tv) {
            // This can prevent others from being able to listen to mouse events
            dom.addEventListener(dragSourceElement, 'mousedown', dragInitSlidee as EventListener, {
                //passive: true
            });
        }

        initFrameResizeObserver();

        if (transform) {
            dom.addEventListener(dragSourceElement, 'touchstart', dragInitSlidee as EventListener, {
                passive: true
            });

            if (!o.horizontal) {
                dom.addEventListener(frame, 'scroll', resetScroll as EventListener, {
                    passive: true
                });
            }

            if (o.mouseWheel) {
                // Scrolling navigation
                dom.addEventListener(scrollSource, wheelEvent, scrollHandler as EventListener, {
                    passive: false
                });
            }
        } else if (o.horizontal && o.mouseWheel) {
            // Don't bind to mouse events with vertical scroll since the mouse wheel can handle this natively

            // Scrolling navigation
            dom.addEventListener(scrollSource, wheelEvent, scrollHandler as EventListener, {
                passive: false
            });
        }

        dom.addEventListener(frame, 'click', onFrameClick as EventListener, {
            passive: true,
            capture: true
        });

        // Mark instance as initialized
        self.initialized = 1;

        // Load
        load(true);

        // Return instance
        return self;
    };
} as unknown as {
    new (frame: HTMLElement, options?: ScrollerOptions): ScrollerInstance;
    prototype: ScrollerInstance;
    create(frame: HTMLElement, options?: ScrollerOptions): Promise<ScrollerInstance>;
};

interface ScrollerInstance {
    options: ScrollerOptions;
    _pos: ScrollerPos;
    initialized: number;
    slidee: HTMLElement;
    dragging: DraggingState;
    frameResizeObserver: ResizeObserver | null;
    reload(): void;
    getScrollEventName(): string;
    getScrollSlider(): HTMLElement;
    getScrollFrame(): HTMLElement;
    slideTo(newPos: number, immediate?: boolean, fullItemPos?: ItemPos): void;
    getPos(item: HTMLElement): ItemPos;
    getCenterPosition(item: HTMLElement): number;
    getScrollPosition(): number;
    getScrollSize(): number;
    init(): ScrollerInstance | undefined;
    destroy(): ScrollerInstance;
    slideBy(delta: number, immediate?: boolean): void;
    to(location: string, item?: HTMLElement | boolean, immediate?: boolean): void;
    toStart(item?: HTMLElement | boolean, immediate?: boolean): void;
    toEnd(item?: HTMLElement | boolean, immediate?: boolean): void;
    toCenter(item?: HTMLElement | boolean, immediate?: boolean): void;
}

/**
 * Slide SLIDEE by amount of pixels.
 *
 * @param {Int}  delta     Pixels/Items. Positive means forward, negative means backward.
 * @param {Bool} immediate Reposition immediately without an animation.
 *
 * @return {Void}
 */
scrollerFactory.prototype.slideBy = function (this: ScrollerInstance, delta: number, immediate?: boolean): void {
    if (!delta) {
        return;
    }
    this.slideTo(this._pos.dest + delta, immediate);
};

/**
 * Core method for handling `toLocation` methods.
 *
 * @param  {String} location
 * @param  {Mixed}  item
 * @param  {Bool}   immediate
 *
 * @return {Void}
 */
scrollerFactory.prototype.to = function (this: ScrollerInstance, location: string, item?: HTMLElement | boolean, immediate?: boolean): void {
    // Optional arguments logic
    if (type(item) === 'boolean') {
        immediate = item as unknown as boolean;
        item = undefined;
    }

    if (item === undefined) {
        this.slideTo(this._pos[location as keyof ScrollerPos], immediate);
    } else {
        const itemPos = this.getPos(item as HTMLElement);

        if (itemPos) {
            this.slideTo(itemPos[location as keyof ItemPos] as number, immediate, itemPos);
        }
    }
};

/**
 * Animate element or the whole SLIDEE to the start of the frame.
 *
 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
 * @param {Bool}  immediate Reposition immediately without an animation.
 *
 * @return {Void}
 */
scrollerFactory.prototype.toStart = function (this: ScrollerInstance, item?: HTMLElement | boolean, immediate?: boolean): void {
    this.to('start', item, immediate);
};

/**
 * Animate element or the whole SLIDEE to the end of the frame.
 *
 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
 * @param {Bool}  immediate Reposition immediately without an animation.
 *
 * @return {Void}
 */
scrollerFactory.prototype.toEnd = function (this: ScrollerInstance, item?: HTMLElement | boolean, immediate?: boolean): void {
    this.to('end', item, immediate);
};

/**
 * Animate element or the whole SLIDEE to the center of the frame.
 *
 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
 * @param {Bool}  immediate Reposition immediately without an animation.
 *
 * @return {Void}
 */
scrollerFactory.prototype.toCenter = function (this: ScrollerInstance, item?: HTMLElement | boolean, immediate?: boolean): void {
    this.to('center', item, immediate);
};

scrollerFactory.create = function (frame: HTMLElement, options?: ScrollerOptions): Promise<ScrollerInstance> {
    // eslint-disable-next-line new-cap
    const instance = new scrollerFactory(frame, options);
    return Promise.resolve(instance);
};

export default scrollerFactory;
