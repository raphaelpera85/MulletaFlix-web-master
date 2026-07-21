import ScrollerFactory from 'lib/scroller';
import dom from '../../utils/dom';
import layoutManager from '../../components/layoutManager';
import inputManager from '../../scripts/inputManager';
import focusManager from '../../components/focusManager';
import browser from '../../scripts/browser';
import 'webcomponents.js/webcomponents-lite';
import './emby-scroller.scss';

const ScrollerPrototype: HTMLDivElement = Object.create(HTMLDivElement.prototype);

(ScrollerPrototype as any).createdCallback = function (this: ScrollerElement): void {
    this.classList.add('emby-scroller');
};

function initCenterFocus(elem: ScrollerElement, scrollerInstance: any): void {
    dom.addEventListener(elem, 'focus', function (e: FocusEvent) {
        const focused = focusManager.focusableParent(e.target as HTMLElement);
        if (focused) {
            scrollerInstance.toCenter(focused);
        }
    } as unknown as EventListener, {
        capture: true,
        passive: true
    });
}

(ScrollerPrototype as any).scrollToBeginning = function (this: ScrollerElement): void {
    if (this.scroller) {
        this.scroller.slideTo(0, true);
    }
};

(ScrollerPrototype as any).toStart = function (this: ScrollerElement, elem: HTMLElement, immediate: boolean): void {
    if (this.scroller) {
        this.scroller.toStart(elem, immediate);
    }
};

(ScrollerPrototype as any).toCenter = function (this: ScrollerElement, elem: HTMLElement, immediate: boolean): void {
    if (this.scroller) {
        this.scroller.toCenter(elem, immediate);
    }
};

(ScrollerPrototype as any).scrollToPosition = function (this: ScrollerElement, pos: number, immediate: boolean): void {
    if (this.scroller) {
        this.scroller.slideTo(pos, immediate);
    }
};

(ScrollerPrototype as any).getScrollPosition = function (this: ScrollerElement): number | undefined {
    if (this.scroller) {
        return this.scroller.getScrollPosition();
    }
};

(ScrollerPrototype as any).getScrollSize = function (this: ScrollerElement): number | undefined {
    if (this.scroller) {
        return this.scroller.getScrollSize();
    }
};

(ScrollerPrototype as any).getScrollEventName = function (this: ScrollerElement): string | undefined {
    if (this.scroller) {
        return this.scroller.getScrollEventName();
    }
};

(ScrollerPrototype as any).getScrollSlider = function (this: ScrollerElement): HTMLElement | undefined {
    if (this.scroller) {
        return this.scroller.getScrollSlider();
    }
};

(ScrollerPrototype as any).addScrollEventListener = function (this: ScrollerElement, fn: () => void, options?: AddEventListenerOptions): void {
    if (this.scroller) {
        dom.addEventListener(this.scroller.getScrollFrame(), this.scroller.getScrollEventName(), fn as unknown as EventListener, options);
    }
};

(ScrollerPrototype as any).removeScrollEventListener = function (this: ScrollerElement, fn: () => void, options?: EventListenerOptions): void {
    if (this.scroller) {
        dom.removeEventListener(this.scroller.getScrollFrame(), this.scroller.getScrollEventName(), fn as unknown as EventListener, options);
    }
};

interface InputCommandEvent extends CustomEvent {
    detail: {
        command: string;
    };
}

function onInputCommand(this: ScrollerElement, e: InputCommandEvent): void {
    const cmd: string = e.detail.command;
    if (cmd === 'end') {
        focusManager.focusLast(this, '.' + this.getAttribute('data-navcommands'));
        e.preventDefault();
        e.stopPropagation();
    } else if (cmd === 'pageup') {
        focusManager.moveFocus(e.target as HTMLElement, this, '.' + this.getAttribute('data-navcommands'), -12);
        e.preventDefault();
        e.stopPropagation();
    } else if (cmd === 'pagedown') {
        focusManager.moveFocus(e.target as HTMLElement, this, '.' + this.getAttribute('data-navcommands'), 12);
        e.preventDefault();
        e.stopPropagation();
    }
}

(ScrollerPrototype as any).attachedCallback = function (this: ScrollerElement): void {
    if (this.getAttribute('data-navcommands')) {
        inputManager.on(this, onInputCommand as unknown as (e: Event) => void);
    }

    const horizontal: boolean = this.getAttribute('data-horizontal') !== 'false';

    const slider = this.querySelector('.scrollSlider') as HTMLElement;

    if (horizontal) {
        (slider.style as unknown as Record<string, string>)['white-space'] = 'nowrap';
    }

    const scrollFrame = this;
    const enableScrollButtons: boolean = layoutManager.desktop && !browser.touch && horizontal && this.getAttribute('data-scrollbuttons') !== 'false';
    const useNativeScroll: boolean = !enableScrollButtons;

    const options: Record<string, any> = {
        horizontal: horizontal,
        mouseDragging: 1,
        mouseWheel: this.getAttribute('data-mousewheel') !== 'false',
        touchDragging: 1,
        slidee: slider,
        scrollBy: 200,
        speed: horizontal ? 270 : 240,
        elasticBounds: 1,
        dragHandle: 1,
        autoImmediate: true,
        skipSlideToWhenVisible: this.getAttribute('data-skipfocuswhenvisible') === 'true',
        dispatchScrollEvent: enableScrollButtons || this.getAttribute('data-scrollevent') === 'true',
        hideScrollbar: enableScrollButtons || this.getAttribute('data-hidescrollbar') === 'true',
        allowNativeSmoothScroll: this.getAttribute('data-allownativesmoothscroll') === 'true' && useNativeScroll,
        allowNativeScroll: useNativeScroll,
        forceHideScrollbars: enableScrollButtons,
        // In edge, with the native scroll, the content jumps around when hovering over the buttons
        requireAnimation: enableScrollButtons && browser.edge
    };

    // If just inserted it might not have any height yet - yes this is a hack
    this.scroller = new ScrollerFactory(scrollFrame, options);
    this.scroller.init();
    this.scroller.reload();

    if (layoutManager.tv && this.getAttribute('data-centerfocus')) {
        initCenterFocus(this, this.scroller);
    }

    if (enableScrollButtons) {
        loadScrollButtons(this);
    }
};

function loadScrollButtons(buttonsScroller: ScrollerElement): void {
    import('../emby-scrollbuttons/emby-scrollbuttons').then(() => {
        buttonsScroller.insertAdjacentHTML('beforebegin', '<div is="emby-scrollbuttons" class="emby-scrollbuttons padded-right"></div>');
    });
}

(ScrollerPrototype as any).pause = function (this: ScrollerElement): void {
    const headroom = this.headroom;
    if (headroom) {
        headroom.pause();
    }
};

(ScrollerPrototype as any).resume = function (this: ScrollerElement): void {
    const headroom = this.headroom;
    if (headroom) {
        headroom.resume();
    }
};

(ScrollerPrototype as any).detachedCallback = function (this: ScrollerElement): void {
    if (this.getAttribute('data-navcommands')) {
        inputManager.off(this, onInputCommand as unknown as (e: Event) => void);
    }

    const headroom = this.headroom;
    if (headroom) {
        headroom.destroy();
        this.headroom = null;
    }

    const scrollerInstance = this.scroller;
    if (scrollerInstance) {
        scrollerInstance.destroy();
        this.scroller = null;
    }
};

interface ScrollerInstance {
    slideTo(pos: number, immediate: boolean): void;
    toStart(elem: HTMLElement, immediate: boolean): void;
    toCenter(elem: HTMLElement, immediate: boolean): void;
    getScrollPosition(): number;
    getScrollSize(): number;
    getScrollEventName(): string;
    getScrollSlider(): HTMLElement;
    getScrollFrame(): HTMLElement;
    init(): void;
    reload(): void;
    destroy(): void;
}

interface HeadroomInstance {
    pause(): void;
    resume(): void;
    destroy(): void;
}

interface ScrollerElement extends HTMLDivElement {
    scroller?: ScrollerInstance | null;
    headroom?: HeadroomInstance | null;
}

document.registerElement('emby-scroller', {
    prototype: ScrollerPrototype,
    extends: 'div'
});
