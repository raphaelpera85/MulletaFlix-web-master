import 'webcomponents.js/webcomponents-lite';
import dom from '../../utils/dom';
import ScrollerFactory from 'lib/scroller';
import browser from '../../scripts/browser';
import focusManager from '../../components/focusManager';
import layoutManager from '../../components/layoutManager';
import './emby-tabs.scss';
import '../../styles/scrollstyles.scss';

const EmbyTabs = Object.create(HTMLDivElement.prototype);
const buttonClass = 'emby-tab-button';
const activeButtonClass = buttonClass + '-active';

function setActiveTabButton(newButton: Element): void {
    newButton.classList.add(activeButtonClass);
}

function getTabPanel(): HTMLElement | null {
    return null;
}

function removeActivePanelClass(): void {
    const tabPanel = getTabPanel();
    if (tabPanel) {
        tabPanel.classList.remove('is-active');
    }
}

function fadeInRight(elem: HTMLElement): void {
    const pct = browser.mobile ? '4%' : '0.5%';

    const keyframes = [
        { opacity: '0', transform: 'translate3d(' + pct + ', 0, 0)', offset: 0 },
        { opacity: '1', transform: 'none', offset: 1 }];

    elem.animate(keyframes, {
        duration: 160,
        iterations: 1,
        easing: 'ease-out'
    });
}

function triggerBeforeTabChange(tabs: EmbyTabsElement, index: number, previousIndex: number | null): void {
    tabs.dispatchEvent(new CustomEvent('beforetabchange', {
        detail: {
            selectedTabIndex: index,
            previousIndex: previousIndex
        }
    }));
    if (previousIndex != null && previousIndex !== index) {
        removeActivePanelClass();
    }

    const newPanel = getTabPanel();

    if (newPanel) {
        // animate new panel ?
        if ('animate' in newPanel) {
            fadeInRight(newPanel);
        }

        newPanel.classList.add('is-active');
    }
}

function onClick(this: EmbyTabsElement, e: MouseEvent): void {
    const tabs = this;

    const current = tabs.querySelector('.' + activeButtonClass);
    const tabButton = dom.parentWithClass(e.target as HTMLElement, buttonClass) as HTMLElement | null;

    if (tabButton && tabButton !== current) {
        if (current) {
            current.classList.remove(activeButtonClass);
        }

        const previousIndex = current ? parseInt(current.getAttribute('data-index')!, 10) : null;

        setActiveTabButton(tabButton);

        const index = parseInt(tabButton.getAttribute('data-index')!, 10);

        triggerBeforeTabChange(tabs, index, previousIndex);

        // If toCenter is called syncronously within the click event, it sometimes ends up canceling it
        setTimeout(function () {
            tabs.selectedTabIndex = index;

            tabs.dispatchEvent(new CustomEvent('tabchange', {
                detail: {
                    selectedTabIndex: index,
                    previousIndex: previousIndex
                }
            }));
        }, 120);

        if (tabs.scroller) {
            tabs.scroller.toCenter(tabButton, false);
        }
    }
}

function onFocusIn(this: EmbyTabsElement, e: FocusEvent): void {
    const tabs = this;
    const tabButton = dom.parentWithClass(e.target as HTMLElement, buttonClass) as HTMLElement | null;
    if (tabButton && tabs.scroller) {
        tabs.scroller.toCenter(tabButton, false);
    }
}

function onFocusOut(e: FocusEvent): void {
    const parentContainer = (e.target as Element).parentNode as Element;
    const previousFocus = parentContainer.querySelector('.lastFocused');
    if (previousFocus) {
        previousFocus.classList.remove('lastFocused');
    }
    (e.target as Element).classList.add('lastFocused');
}

function initScroller(tabs: EmbyTabsElement): void {
    if (tabs.scroller) {
        return;
    }

    const contentScrollSlider = tabs.querySelector('.emby-tabs-slider') as HTMLElement;
    if (contentScrollSlider) {
        tabs.scroller = new ScrollerFactory(tabs, {
            horizontal: true,
            itemNav: 0,
            mouseDragging: 1,
            touchDragging: 1,
            slidee: contentScrollSlider as any,
            smart: true,
            releaseSwing: true,
            scrollBy: 200,
            speed: 120,
            elasticBounds: 1,
            dragHandle: 1,
            dynamicHandle: 1,
            clickBar: 1,
            hiddenScroll: true,

            // In safari the transform is causing the headers to occasionally disappear or flicker
            requireAnimation: !browser.safari,
            allowNativeSmoothScroll: true
        }) as unknown as EmbyTabsElement['scroller'];
        tabs.scroller!.init();
    } else {
        tabs.classList.add('scrollX');
        tabs.classList.add('hiddenScrollX');
        tabs.classList.add('smoothScrollX');
    }
}

EmbyTabs.createdCallback = function (): void {
    if (this.classList.contains('emby-tabs')) {
        return;
    }
    this.classList.add('emby-tabs');
    this.classList.add('focusable');

    dom.addEventListener(this, 'click', onClick as EventListener, {
        passive: true
    });

    if (layoutManager.tv) {
        dom.addEventListener(this, 'focusin', onFocusIn as EventListener, { passive: true });
    }

    dom.addEventListener(this, 'focusout', onFocusOut as EventListener);
};

EmbyTabs.focus = function (): void {
    const selectedTab = this.querySelector('.' + activeButtonClass);
    const lastFocused = this.querySelector('.lastFocused');

    if (lastFocused) {
        focusManager.focus(lastFocused);
    } else if (selectedTab) {
        focusManager.focus(selectedTab);
    } else {
        focusManager.autoFocus(this);
    }
};

EmbyTabs.refresh = function (): void {
    if (this.scroller) {
        this.scroller.reload();
    }
};

EmbyTabs.attachedCallback = function (): void {
    initScroller(this);

    const current = this.querySelector('.' + activeButtonClass);
    const currentIndex = current ? parseInt(current.getAttribute('data-index')!, 10) : parseInt(this.getAttribute('data-index') || '0', 10);

    if (currentIndex !== -1) {
        this.selectedTabIndex = currentIndex;

        const tabButtons = this.querySelectorAll('.' + buttonClass);

        const newTabButton = tabButtons[currentIndex];

        if (newTabButton) {
            setActiveTabButton(newTabButton);
        }
    }

    if (!this.readyFired) {
        this.readyFired = true;
        this.dispatchEvent(new CustomEvent('ready', {}));
    }
};

EmbyTabs.detachedCallback = function (): void {
    if (this.scroller) {
        this.scroller.destroy();
        this.scroller = null;
    }

    dom.removeEventListener(this, 'click', onClick as EventListener, {
        passive: true
    });

    if (layoutManager.tv) {
        dom.removeEventListener(this, 'focusin', onFocusIn as EventListener, { passive: true });
    }
};

function getSelectedTabButton(elem: EmbyTabsElement): Element | null {
    return elem.querySelector('.' + activeButtonClass);
}

EmbyTabs.selectedIndex = function (selected?: number | null, triggerEvent?: boolean): number | void {
    const tabs = this;

    if (selected == null) {
        return tabs.selectedTabIndex || 0;
    }

    const current = tabs.selectedIndex();

    tabs.selectedTabIndex = selected;

    const tabButtons = tabs.querySelectorAll('.' + buttonClass);

    if (current === selected || triggerEvent === false) {
        triggerBeforeTabChange(tabs, selected, current);

        tabs.dispatchEvent(new CustomEvent('tabchange', {
            detail: {
                selectedTabIndex: selected
            }
        }));

        const currentTabButton = tabButtons[current as number];
        setActiveTabButton(tabButtons[selected]);

        if (current !== selected && currentTabButton) {
            currentTabButton.classList.remove(activeButtonClass);
        }
    } else {
        onClick.call(tabs, {
            target: tabButtons[selected]
        } as unknown as MouseEvent);
    }
};

function getSibling(elem: Element | null, method: 'nextSibling' | 'previousSibling'): Element | null {
    if (!elem) return null;
    let sibling: Element | null = elem[method] as Element | null;

    while (sibling) {
        if (sibling.classList.contains(buttonClass) && !sibling.classList.contains('hide')) {
            return sibling;
        }

        sibling = sibling[method] as Element | null;
    }

    return null;
}

EmbyTabs.selectNext = function (): void {
    const current = getSelectedTabButton(this);

    const sibling = getSibling(current, 'nextSibling');

    if (sibling) {
        onClick.call(this, {
            target: sibling
        } as unknown as MouseEvent);
    }
};

EmbyTabs.selectPrevious = function (): void {
    const current = getSelectedTabButton(this);

    const sibling = getSibling(current, 'previousSibling');

    if (sibling) {
        onClick.call(this, {
            target: sibling
        } as unknown as MouseEvent);
    }
};

EmbyTabs.triggerBeforeTabChange = function (): void {
    const tabs = this;

    triggerBeforeTabChange(tabs, tabs.selectedIndex(), null);
};

EmbyTabs.triggerTabChange = function (): void {
    const tabs = this;

    tabs.dispatchEvent(new CustomEvent('tabchange', {
        detail: {
            selectedTabIndex: tabs.selectedIndex()
        }
    }));
};

EmbyTabs.setTabEnabled = function (index: number, enabled: boolean): void {
    const btn = this.querySelector(`.emby-tab-button[data-index="${index}"]`);

    if (btn) {
        if (enabled) {
            btn.classList.remove('hide');
        } else {
            btn.classList.remove('add');
        }
    }
};

document.registerElement('emby-tabs', {
    prototype: EmbyTabs,
    extends: 'div'
});

interface EmbyTabsElement extends HTMLDivElement {
    selectedTabIndex: number;
    readyFired: boolean;
    scroller: {
        toCenter: (elem: Element, smooth: boolean) => void;
        init: () => void;
        reload: () => void;
        destroy: () => void;
    } | null;
}
