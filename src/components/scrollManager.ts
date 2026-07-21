/**
 * Module for controlling scroll behavior.
 * @module components/scrollManager
 */

import dom from '../utils/dom';
import appSettings from 'scripts/settings/appSettings';
import layoutManager from './layoutManager';

/**
 * Scroll time in ms.
 */
const ScrollTime = 270;

/**
 * Epsilon for comparing values.
 */
const Epsilon = 1e-6;

// FIXME: Need to scroll to top of page to fully show the top menu. This can be solved by some marker of top most elements or their containers
/**
 * Returns minimum vertical scroll.
 * Scroll less than that value will be zeroed.
 *
 * @return {number} Minimum vertical scroll.
 */
function minimumScrollY(): number {
    const topMenu = document.querySelector('.headerTop');
    if (topMenu) {
        return topMenu.clientHeight;
    }
    return 0;
}

let supportsScrollToOptions = false;
try {
    const elem = document.createElement('div');

    const opts = Object.defineProperty({}, 'behavior', {
        get: function () {
            supportsScrollToOptions = true;
            return 'auto';
        }
    });

    elem.scrollTo(opts as ScrollToOptions);
} catch {
    // no scroll to options support
}

/**
 * Returns value clamped by range [min, max].
 *
 * @param value - Clamped value.
 * @param min - Begining of range.
 * @param max - Ending of range.
 * @return Clamped value.
 */
function clamp(value: number, min: number, max: number): number {
    if (value <= min) {
        return min;
    } else if (value >= max) {
        return max;
    }
    return value;
}

/**
 * Returns the required delta to fit range 1 into range 2.
 * In case of range 1 is bigger than range 2 returns delta to fit most out of range part.
 *
 * @param begin1 - Begining of range 1.
 * @param end1 - Ending of range 1.
 * @param begin2 - Begining of range 2.
 * @param end2 - Ending of range 2.
 * @return Delta: <0 move range1 to the left, >0 - to the right.
 */
function fitRange(begin1: number, end1: number, begin2: number, end2: number): number {
    const delta1 = begin1 - begin2;
    const delta2 = end2 - end1;
    if (delta1 < 0 && delta1 < delta2) {
        return -delta1;
    } else if (delta2 < 0) {
        return delta2;
    }
    return 0;
}

/**
 * Ease value.
 *
 * @param t - Value in range [0, 1].
 * @return Eased value in range [0, 1].
 */
function ease(t: number): number {
    return t * (2 - t); // easeOutQuad === ease-out
}

/**
 * @typedef {Object} Rect
 * @property {number} left - X coordinate of top-left corner.
 * @property {number} top - Y coordinate of top-left corner.
 * @property {number} width - Width.
 * @property {number} height - Height.
 */
interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/**
 * Document scroll wrapper helps to unify scrolling and fix issues of some browsers.
 *
 * webOS 2 Browser: scrolls documentElement (and window), but body has a scroll size
 *
 * webOS 3 Browser: scrolls body (and window)
 *
 * webOS 4 Native: scrolls body (and window); has a document.scrollingElement
 *
 * Tizen 4 Browser/Native: scrolls body (and window); has a document.scrollingElement
 *
 * Tizen 5 Browser/Native: scrolls documentElement (and window); has a document.scrollingElement
 */
class DocumentScroller {
    /**
     * Horizontal scroll position.
     * @type {number}
     */
    get scrollLeft(): number {
        return window.pageXOffset;
    }

    set scrollLeft(val: number) {
        window.scroll(val, window.pageYOffset);
    }

    /**
     * Vertical scroll position.
     * @type {number}
     */
    get scrollTop(): number {
        return window.pageYOffset;
    }

    set scrollTop(val: number) {
        window.scroll(window.pageXOffset, val);
    }

    /**
     * Horizontal scroll size (scroll width).
     * @type {number}
     */
    get scrollWidth(): number {
        return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    }

    /**
     * Vertical scroll size (scroll height).
     * @type {number}
     */
    get scrollHeight(): number {
        return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    }

    /**
     * Horizontal client size (client width).
     * @type {number}
     */
    get clientWidth(): number {
        return Math.min(document.documentElement.clientWidth, document.body.clientWidth);
    }

    /**
     * Vertical client size (client height).
     * @type {number}
     */
    get clientHeight(): number {
        return Math.min(document.documentElement.clientHeight, document.body.clientHeight);
    }

    /**
     * Returns attribute value.
     * @param attributeName - Attibute name.
     * @return Attibute value.
     */
    getAttribute(attributeName: string): string | null {
        return document.body.getAttribute(attributeName);
    }

    /**
     * Returns bounding client rect.
     * @return Bounding client rect.
     */
    getBoundingClientRect(): Rect {
        // Make valid viewport coordinates: documentElement.getBoundingClientRect returns rect of entire document relative to viewport
        return {
            left: 0,
            top: 0,
            width: this.clientWidth,
            height: this.clientHeight
        };
    }

    /**
     * Scrolls window.
     */
    scrollTo(...args: [number, number] | [ScrollToOptions]): void {
        if (args.length === 1) {
            window.scrollTo(args[0]);
        } else {
            window.scrollTo(args[0], args[1]);
        }
    }
}

/**
 * Default (document) scroller.
 */
const documentScroller = new DocumentScroller();

const scrollerHints = {
    x: {
        nameScroll: 'scrollWidth',
        nameClient: 'clientWidth',
        nameStyle: 'overflowX',
        nameScrollMode: 'data-scroll-mode-x'
    },
    y: {
        nameScroll: 'scrollHeight',
        nameClient: 'clientHeight',
        nameStyle: 'overflowY',
        nameScrollMode: 'data-scroll-mode-y'
    }
} as const;

type ScrollableParent = HTMLElement | DocumentScroller;

/**
 * Returns parent element that can be scrolled. If no such, returns document scroller.
 *
 * @param element - Element for which parent is being searched.
 * @param vertical - Search for vertical scrollable parent.
 * @return Parent element that can be scrolled or document scroller.
 */
function getScrollableParent(element: HTMLElement | null, vertical: boolean): ScrollableParent {
    if (element) {
        const scrollerHint = vertical ? scrollerHints.y : scrollerHints.x;

        let parent = element.parentElement;

        while (parent && parent !== document.body) {
            const scrollMode = parent.getAttribute(scrollerHint.nameScrollMode);

            // Stop on self-scrolled containers
            if (scrollMode === 'custom') {
                return parent;
            }

            const styles = window.getComputedStyle(parent);

            // Stop on fixed parent
            if (styles.position === 'fixed') {
                return parent;
            }

            const overflow = styles[scrollerHint.nameStyle];

            if (overflow === 'scroll' || overflow === 'auto' && (parent as unknown as HTMLElement)[scrollerHint.nameScroll] > (parent as unknown as HTMLElement)[scrollerHint.nameClient]) {
                return parent;
            }

            parent = parent.parentElement;
        }
    }

    return documentScroller;
}

/**
 * @typedef {Object} ScrollerData
 * @property {number} scrollPos - Current scroll position.
 * @property {number} scrollSize - Scroll size.
 * @property {number} clientSize - Client size.
 * @property {string} mode - Scrolling mode.
 * @property {boolean} custom - Custom scrolling mode.
 */
interface ScrollerData {
    scrollPos: number;
    scrollSize: number;
    clientSize: number;
    mode: string | null;
    custom: boolean;
}

/**
 * Returns scroller data for specified orientation.
 *
 * @param scroller - Scroller.
 * @param vertical - Vertical scroller data.
 * @return Scroller data.
 */
function getScrollerData(scroller: ScrollableParent, vertical: boolean): ScrollerData {
    const data: ScrollerData = {
        scrollPos: 0,
        scrollSize: 0,
        clientSize: 0,
        mode: null,
        custom: false
    };

    if (!vertical) {
        data.scrollPos = scroller.scrollLeft;
        data.scrollSize = scroller.scrollWidth;
        data.clientSize = scroller.clientWidth;
        data.mode = scroller.getAttribute(scrollerHints.x.nameScrollMode);
    } else {
        data.scrollPos = scroller.scrollTop;
        data.scrollSize = scroller.scrollHeight;
        data.clientSize = scroller.clientHeight;
        data.mode = scroller.getAttribute(scrollerHints.y.nameScrollMode);
    }

    data.custom = data.mode === 'custom';

    return data;
}

/**
 * Returns position of child of scroller for specified orientation.
 *
 * @param scroller - Scroller.
 * @param element - Child of scroller.
 * @param vertical - Vertical scroll.
 * @return Child position.
 */
function getScrollerChildPos(scroller: ScrollableParent, element: HTMLElement, vertical: boolean): number {
    const elementRect = element.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();

    if (!vertical) {
        return scroller.scrollLeft + elementRect.left - scrollerRect.left;
    } else {
        return scroller.scrollTop + elementRect.top - scrollerRect.top;
    }
}

/**
 * Returns scroll position for element.
 *
 * @param scrollerData - Scroller data.
 * @param elementPos - Child element position.
 * @param elementSize - Child element size.
 * @param centered - Scroll to center.
 * @return Scroll position.
 */
function calcScroll(scrollerData: ScrollerData, elementPos: number, elementSize: number, centered: boolean): number {
    const maxScroll = scrollerData.scrollSize - scrollerData.clientSize;

    let scroll;

    if (centered) {
        scroll = elementPos + (elementSize - scrollerData.clientSize) / 2;
    } else {
        const delta = fitRange(elementPos, elementPos + elementSize - 1, scrollerData.scrollPos, scrollerData.scrollPos + scrollerData.clientSize - 1);
        scroll = scrollerData.scrollPos - delta;
    }

    return clamp(Math.round(scroll), 0, maxScroll);
}

/**
 * Calls scrollTo function in proper way.
 *
 * @param scroller - Scroller.
 * @param options - Scroll options.
 */
function scrollToHelper(scroller: ScrollableParent, options: ScrollToOptions): void {
    const scrollable = scroller as {
        scrollTo?: (...args: [number, number] | [ScrollToOptions]) => void;
        scrollLeft: number;
        scrollTop: number;
    };

    if (scrollable.scrollTo) {
        if (!supportsScrollToOptions) {
            const scrollX = (options.left !== undefined ? options.left : scrollable.scrollLeft);
            const scrollY = (options.top !== undefined ? options.top : scrollable.scrollTop);
            scrollable.scrollTo(scrollX, scrollY);
        } else {
            scrollable.scrollTo(options);
        }
    } else {
        if (options.left !== undefined) {
            scrollable.scrollLeft = options.left;
        }
        if (options.top !== undefined) {
            scrollable.scrollTop = options.top;
        }
    }
}

/**
 * Performs built-in scroll.
 *
 * @param xScroller - Horizontal scroller.
 * @param scrollX - Horizontal coordinate.
 * @param yScroller - Vertical scroller.
 * @param scrollY - Vertical coordinate.
 * @param smooth - Smooth scrolling.
 */
function builtinScroll(xScroller: ScrollableParent | null, scrollX: number, yScroller: ScrollableParent | null, scrollY: number, smooth: boolean): void {
    const scrollBehavior = smooth ? 'smooth' : 'instant';

    if (xScroller !== yScroller) {
        if (xScroller) {
            scrollToHelper(xScroller, { left: scrollX, behavior: scrollBehavior });
        }
        if (yScroller) {
            scrollToHelper(yScroller, { top: scrollY, behavior: scrollBehavior });
        }
    } else if (xScroller) {
        scrollToHelper(xScroller, { left: scrollX, top: scrollY, behavior: scrollBehavior });
    }
}

/**
 * Requested frame for animated scroll.
 */
let scrollTimer: number | undefined;

/**
 * Resets scroll timer to stop scrolling.
 */
function resetScrollTimer(): void {
    if (scrollTimer !== undefined) {
        cancelAnimationFrame(scrollTimer);
    }
    scrollTimer = undefined;
}

/**
 * Performs animated scroll.
 *
 * @param xScroller - Horizontal scroller.
 * @param scrollX - Horizontal coordinate.
 * @param yScroller - Vertical scroller.
 * @param scrollY - Vertical coordinate.
 */
function animateScroll(xScroller: ScrollableParent | null, scrollX: number, yScroller: ScrollableParent | null, scrollY: number): void {
    const ox = xScroller ? xScroller.scrollLeft : scrollX;
    const oy = yScroller ? yScroller.scrollTop : scrollY;
    const dx = scrollX - ox;
    const dy = scrollY - oy;

    if (Math.abs(dx) < Epsilon && Math.abs(dy) < Epsilon) {
        return;
    }

    let start: number | undefined;

    function scrollAnim(currentTimestamp: number): void {
        start = start || currentTimestamp;

        let k = Math.min(1, (currentTimestamp - start) / ScrollTime);

        if (k === 1) {
            resetScrollTimer();
            builtinScroll(xScroller, scrollX, yScroller, scrollY, false);
            return;
        }

        k = ease(k);

        const x = ox + dx * k;
        const y = oy + dy * k;

        builtinScroll(xScroller, x, yScroller, y, false);

        scrollTimer = requestAnimationFrame(scrollAnim);
    }

    scrollTimer = requestAnimationFrame(scrollAnim);
}

/**
 * Performs scroll.
 *
 * @param xScroller - Horizontal scroller.
 * @param scrollX - Horizontal coordinate.
 * @param yScroller - Vertical scroller.
 * @param scrollY - Vertical coordinate.
 * @param smooth - Smooth scrolling.
 */
function doScroll(xScroller: ScrollableParent | null, scrollX: number, yScroller: ScrollableParent | null, scrollY: number, smooth: boolean): void {
    resetScrollTimer();

    if (smooth) {
        animateScroll(xScroller, scrollX, yScroller, scrollY);
    } else {
        builtinScroll(xScroller, scrollX, yScroller, scrollY, false);
    }
}

/**
 * Returns true if smooth scroll must be used.
 */
function useSmoothScroll(): boolean {
    return appSettings.enableSmoothScroll();
}

/**
 * Returns true if scroll manager is enabled.
 */
export function isEnabled(): boolean {
    return layoutManager.tv;
}

/**
 * Scrolls the document to a given position.
 *
 * @param scrollX - Horizontal coordinate.
 * @param scrollY - Vertical coordinate.
 * @param smooth - Smooth scrolling.
 */
export function scrollTo(scrollX: number, scrollY: number, smooth?: boolean): void {
    smooth = !!smooth;

    // Scroller is document itself by default
    const scroller = getScrollableParent(null, false);

    const xScrollerData = getScrollerData(scroller, false);
    const yScrollerData = getScrollerData(scroller, true);

    scrollX = clamp(Math.round(scrollX), 0, xScrollerData.scrollSize - xScrollerData.clientSize);
    scrollY = clamp(Math.round(scrollY), 0, yScrollerData.scrollSize - yScrollerData.clientSize);

    doScroll(scroller, scrollX, scroller, scrollY, smooth);
}

/**
 * Scrolls the document to a given element.
 *
 * @param element - Target element of scroll task.
 * @param smooth - Smooth scrolling.
 */
export function scrollToElement(element: HTMLElement, smooth?: boolean): void {
    smooth = !!smooth;

    let scrollCenterX = true;
    let scrollCenterY = true;

    const offsetParent = element.offsetParent as HTMLElement | null;

    // In Firefox offsetParent.offsetParent is BODY
    const isFixed = offsetParent && (!offsetParent.offsetParent || window.getComputedStyle(offsetParent).position === 'fixed');

    // Scroll fixed elements to nearest edge (or do not scroll at all)
    if (isFixed) {
        scrollCenterX = scrollCenterY = false;
    }

    let xScroller: ScrollableParent | null = getScrollableParent(element, false);
    let yScroller: ScrollableParent | null = getScrollableParent(element, true);

    const xScrollerData = getScrollerData(xScroller, false);
    const yScrollerData = getScrollerData(yScroller, true);

    // Exit, since we have no control over scrolling in this container
    if (xScroller === yScroller && (xScrollerData.custom || yScrollerData.custom)) {
        return;
    }

    // Exit, since we have no control over scrolling in these containers
    if (xScrollerData.custom && yScrollerData.custom) {
        return;
    }

    const elementRect = element.getBoundingClientRect();

    let scrollX = 0;
    let scrollY = 0;

    if (!xScrollerData.custom) {
        const xPos = getScrollerChildPos(xScroller, element, false);
        scrollX = calcScroll(xScrollerData, xPos, elementRect.width, scrollCenterX);
    } else {
        xScroller = null;
    }

    if (!yScrollerData.custom) {
        const yPos = getScrollerChildPos(yScroller, element, true);
        scrollY = calcScroll(yScrollerData, yPos, elementRect.height, scrollCenterY);

        // WORKAROUND: When element is above viewport (fixed menu), scroll to top
        // TODO: Add scroll direction marker to handle top/bottom navigation
        if (isFixed && elementRect.bottom < 0) {
            scrollY = 0;
        }

        // WORKAROUND: Ensure minimum scroll position for document scroller
        if (scrollY < minimumScrollY() && yScroller === documentScroller) {
            scrollY = 0;
        }
    } else {
        yScroller = null;
    }

    doScroll(xScroller, scrollX, yScroller, scrollY, smooth);
}

if (isEnabled()) {
    dom.addEventListener(window, 'focusin', function (e: Event) {
        setTimeout(function () {
            const target = e.target;
            if (target instanceof HTMLElement) {
                scrollToElement(target, useSmoothScroll());
            }
        }, 0);
    }, { capture: true });
}

export default {
    isEnabled,
    scrollTo,
    scrollToElement
};
