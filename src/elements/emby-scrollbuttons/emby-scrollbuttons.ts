import './emby-scrollbuttons.scss';
import 'webcomponents.js/webcomponents-lite';
import '../emby-button/paper-icon-button-light';
import globalize from 'lib/globalize';
import { scrollerItemSlideIntoView } from './utils';

const EmbyScrollButtonsPrototype: HTMLDivElement = Object.create(HTMLDivElement.prototype);

(EmbyScrollButtonsPrototype as any).createdCallback = function (): void {
    // no-op
};

function getScrollButtonHtml(direction: 'left' | 'right'): string {
    let html = '';
    const icon: string = direction === 'left' ? 'chevron_left' : 'chevron_right';
    const title: string = direction === 'left' ? globalize.translate('Previous') : globalize.translate('Next') ;

    html += `<button type="button" is="paper-icon-button-light" data-ripple="false" data-direction="${direction}" title="${title}" class="emby-scrollbuttons-button">`;
    html += '<span class="material-icons ' + icon + '" aria-hidden="true"></span>';
    html += '</button>';

    return html;
}

function getScrollPosition(parent: ScrollButtonsScrollerElement): number {
    if (parent.getScrollPosition) {
        return parent.getScrollPosition();
    }

    return 0;
}

function getScrollWidth(parent: ScrollButtonsScrollerElement): number {
    if (parent.getScrollSize) {
        return parent.getScrollSize();
    }

    return 0;
}

function updateScrollButtons(scrollButtons: ScrollButtonsElement, scrollSize: number, scrollPos: number, scrollWidth: number): void {
    let localeAwarePos: number = scrollPos;
    if (globalize.getIsElementRTL(scrollButtons)) {
        localeAwarePos *= -1;
    }

    // TODO: Check if hack is really needed
    // hack alert add twenty for rounding errors
    if (scrollWidth <= scrollSize + 20) {
        scrollButtons.scrollButtonsLeft!.classList.add('hide');
        scrollButtons.scrollButtonsRight!.classList.add('hide');
    } else {
        scrollButtons.scrollButtonsLeft!.classList.remove('hide');
        scrollButtons.scrollButtonsRight!.classList.remove('hide');
    }

    if (localeAwarePos > 0) {
        scrollButtons.scrollButtonsLeft!.disabled = false;
    } else {
        scrollButtons.scrollButtonsLeft!.disabled = true;
    }

    const scrollPosEnd: number = localeAwarePos + scrollSize;
    if (scrollWidth > 0 && scrollPosEnd >= scrollWidth) {
        scrollButtons.scrollButtonsRight!.disabled = true;
    } else {
        scrollButtons.scrollButtonsRight!.disabled = false;
    }
}

function onScroll(this: ScrollButtonsElement): void {
    const scrollButtons = this;
    const scroller = this.scroller!;

    const scrollSize: number = getScrollSize(scroller);
    const scrollPos: number = getScrollPosition(scroller);
    const scrollWidth: number = getScrollWidth(scroller);

    updateScrollButtons(scrollButtons, scrollSize, scrollPos, scrollWidth);
}

function getStyleValue(style: CSSStyleDeclaration, name: string): number {
    let value: string | null = style.getPropertyValue(name);
    if (!value) {
        return 0;
    }

    value = value.replace('px', '');
    if (!value) {
        return 0;
    }

    const parsed: number = parseInt(value, 10);
    if (isNaN(parsed)) {
        return 0;
    }

    return parsed;
}

function getScrollSize(elem: ScrollButtonsScrollerElement): number {
    let scrollSize: number = elem.offsetWidth;
    let style: CSSStyleDeclaration = window.getComputedStyle(elem as unknown as Element, null);

    let paddingLeft: number = getStyleValue(style, 'padding-left');
    if (paddingLeft) {
        scrollSize -= paddingLeft;
    }

    let paddingRight: number = getStyleValue(style, 'padding-right');
    if (paddingRight) {
        scrollSize -= paddingRight;
    }

    const slider = elem.getScrollSlider();
    style = window.getComputedStyle(slider, null);

    paddingLeft = getStyleValue(style, 'padding-left');
    if (paddingLeft) {
        scrollSize -= paddingLeft;
    }

    paddingRight = getStyleValue(style, 'padding-right');
    if (paddingRight) {
        scrollSize -= paddingRight;
    }

    return scrollSize;
}

function onScrollButtonClick(this: HTMLElement): void {
    const direction = this.getAttribute('data-direction') as 'left' | 'right';
    const scroller = this.parentNode!.nextSibling as unknown as ScrollButtonsScrollerElement;
    const scrollPosition: number = getScrollPosition(scroller);
    scrollerItemSlideIntoView({
        direction,
        scroller,
        scrollState: {
            scrollPos: scrollPosition
        }
    } as any);
}

(EmbyScrollButtonsPrototype as any).attachedCallback = function (this: ScrollButtonsElement): void {
    const scroller = this.nextSibling as unknown as ScrollButtonsScrollerElement;
    this.scroller = scroller;

    const parent = this.parentNode as HTMLElement;
    parent.classList.add('emby-scroller-container');

    this.innerHTML = getScrollButtonHtml('left') + getScrollButtonHtml('right');

    const buttons = this.querySelectorAll('.emby-scrollbuttons-button');
    (buttons[0] as HTMLElement).addEventListener('click', onScrollButtonClick);
    (buttons[1] as HTMLElement).addEventListener('click', onScrollButtonClick);
    this.scrollButtonsLeft = buttons[0] as HTMLButtonElement;
    this.scrollButtonsRight = buttons[1] as HTMLButtonElement;

    const scrollHandler = onScroll.bind(this) as () => void;
    this.scrollHandler = scrollHandler;
    scroller.addScrollEventListener(scrollHandler, {
        capture: false,
        passive: true
    });

    requestAnimationFrame(() => {
        this.scrollHandler!();
    });
};

(EmbyScrollButtonsPrototype as any).detachedCallback = function (this: ScrollButtonsElement): void {
    const parent = this.scroller;
    this.scroller = null;

    const scrollHandler = this.scrollHandler;
    if (parent && scrollHandler) {
        parent.removeScrollEventListener(scrollHandler, {
            capture: false
        } as EventListenerOptions);
    }

    this.scrollHandler = null;
    this.scrollButtonsLeft = null;
    this.scrollButtonsRight = null;
};

interface ScrollButtonsElement extends HTMLDivElement {
    scroller: ScrollButtonsScrollerElement | null;
    scrollHandler: (() => void) | null;
    scrollButtonsLeft: HTMLButtonElement | null;
    scrollButtonsRight: HTMLButtonElement | null;
}

interface ScrollButtonsScrollerElement {
    offsetWidth: number;
    getScrollPosition(): number;
    getScrollSize(): number;
    getScrollSlider(): HTMLElement;
    addScrollEventListener(fn: () => void, options?: AddEventListenerOptions): void;
    removeScrollEventListener(fn: () => void, options?: EventListenerOptions): void;
    nextSibling: Node | null;
}

document.registerElement('emby-scrollbuttons', {
    prototype: EmbyScrollButtonsPrototype,
    extends: 'div'
});
