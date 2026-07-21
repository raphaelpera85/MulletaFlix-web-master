import dom from '../utils/dom';
import browser from '../scripts/browser';
import layoutManager from './layoutManager';
import Events from '../utils/events.ts';
import type { Event as EventsEvent } from '../utils/events.ts';
import '../elements/emby-tabs/emby-tabs';
import '../elements/emby-button/emby-button';

interface TabItem {
    cssClass?: string;
    enabled?: boolean;
    href?: string;
    name: string;
}

interface TabsElement extends HTMLElement {
    readySelectedIndex?: number | null;
    selectedIndex(index?: number): void;
    selectNext(): void;
    selectPrevious(): void;
    triggerTabChange(): void;
}

interface TabsResult {
    replaced: boolean;
    tabs?: TabsElement | null;
    tabsContainer: HTMLElement | null;
}

let tabOwnerView: HTMLElement | null = null;
const queryScope = document.querySelector<HTMLElement>('.skinHeader');
let headerTabsContainer: HTMLElement | null = null;
let tabsElem: TabsElement | null = null;

function ensureElements(): void {
    if (!headerTabsContainer && queryScope) {
        headerTabsContainer = queryScope.querySelector<HTMLElement>('.headerTabs');
    }
}

function onViewTabsReady(this: TabsElement): void {
    this.selectedIndex(this.readySelectedIndex ?? undefined);
    this.readySelectedIndex = null;
}

function allowSwipe(target: EventTarget | null): boolean {
    function allowSwipeOn(elem: HTMLElement): boolean {
        if (dom.parentWithTag(elem, 'input')) {
            return false;
        }

        const classList = elem.classList;
        if (classList) {
            return !classList.contains('scrollX') && !classList.contains('animatedScrollX');
        }

        return true;
    }

    let parent = target as HTMLElement | null;
    while (parent != null) {
        if (!allowSwipeOn(parent)) {
            return false;
        }
        parent = parent.parentNode as HTMLElement | null;
    }

    return true;
}

function configureSwipeTabs(view: HTMLElement, currentElement: TabsElement): void {
    if (!browser.touch || layoutManager.experimental) {
        return;
    }

    // implement without hammer
    const onSwipeLeft = function (_e: EventsEvent, target: EventTarget | null): void {
        if (allowSwipe(target) && view.contains(target as Node)) {
            currentElement.selectNext();
        }
    };

    const onSwipeRight = function (_e: EventsEvent, target: EventTarget | null): void {
        if (allowSwipe(target) && view.contains(target as Node)) {
            currentElement.selectPrevious();
        }
    };

    import('../scripts/touchHelper').then(({ default: TouchHelper }) => {
        const container = view.parentNode?.parentNode as HTMLElement | null;
        if (!container) {
            return;
        }

        const touchHelper = new TouchHelper(container);

        Events.on(touchHelper, 'swipeleft', onSwipeLeft);
        Events.on(touchHelper, 'swiperight', onSwipeRight);

        view.addEventListener('viewdestroy', function () {
            touchHelper.destroy();
        });
    });
}

export function setTabs(
    view: HTMLElement | null,
    selectedIndex: number | null | undefined = 0,
    getTabsFn: () => any[] = () => [],
    getTabContainersFn?: () => ArrayLike<Element> | undefined,
    onBeforeTabChange?: ((event: any) => void) | null,
    onTabChange?: ((event: any) => void) | null,
    setSelectedIndex = true
): TabsResult {
    ensureElements();

    if (!headerTabsContainer) {
        return {
            tabsContainer: null,
            replaced: false
        };
    }

    if (!view) {
        if (tabOwnerView) {
            document.body.classList.remove('withSectionTabs');

            headerTabsContainer.innerHTML = '';
            headerTabsContainer.classList.add('hide');

            tabOwnerView = null;
        }

        return {
            tabsContainer: headerTabsContainer,
            replaced: false
        };
    }

    const tabsContainerElem = headerTabsContainer;

    if (!tabOwnerView) {
        tabsContainerElem.classList.remove('hide');
    }

    if (tabOwnerView !== view) {
        let index = 0;

        const indexAttribute = selectedIndex == null ? '' : (' data-index="' + selectedIndex + '"');
        const tabs = getTabsFn();
        const tabsHtml = '<div is="emby-tabs"' + indexAttribute + ' class="tabs-viewmenubar"><div class="emby-tabs-slider" style="white-space:nowrap;">' + tabs.map(function (tab) {
            let tabClass = 'emby-tab-button';

            if (tab.enabled === false) {
                tabClass += ' hide';
            }

            let tabHtml;

            if (tab.cssClass) {
                tabClass += ' ' + tab.cssClass;
            }

            if (tab.href) {
                tabHtml = '<a href="' + tab.href + '" is="emby-linkbutton" class="' + tabClass + '" data-index="' + index + '"><div class="emby-button-foreground">' + tab.name + '</div></a>';
            } else {
                tabHtml = '<button type="button" is="emby-button" class="' + tabClass + '" data-index="' + index + '"><div class="emby-button-foreground">' + tab.name + '</div></button>';
            }

            index++;
            return tabHtml;
        }).join('') + '</div></div>';

        tabsContainerElem.innerHTML = tabsHtml;
        window.customElements.upgrade(tabsContainerElem);

        document.body.classList.add('withSectionTabs');
        tabOwnerView = view;

        const currentTabsElem = tabsContainerElem.querySelector('[is="emby-tabs"]') as TabsElement | null;
        if (!currentTabsElem) {
            return {
                tabsContainer: tabsContainerElem,
                replaced: true
            };
        }

        tabsElem = currentTabsElem;

        configureSwipeTabs(view, currentTabsElem);

        if (getTabContainersFn) {
            currentTabsElem.addEventListener('beforetabchange', function (e: Event) {
                const tabEvent = e as CustomEvent<{ previousIndex?: number; selectedTabIndex: number }>;
                const tabContainers = getTabContainersFn();
                if (!tabContainers) {
                    return;
                }
                if (tabEvent.detail.previousIndex != null) {
                    const previousPanel = tabContainers[tabEvent.detail.previousIndex] as HTMLElement | undefined;
                    if (previousPanel) {
                        previousPanel.classList.remove('is-active');
                    }
                }

                const newPanel = tabContainers[tabEvent.detail.selectedTabIndex] as HTMLElement | undefined;

                if (newPanel) {
                    newPanel.classList.add('is-active');
                }
            });
        }

        if (onBeforeTabChange) {
            currentTabsElem.addEventListener('beforetabchange', onBeforeTabChange);
        }
        if (onTabChange) {
            currentTabsElem.addEventListener('tabchange', onTabChange);
        }

        if (setSelectedIndex !== false) {
            if (currentTabsElem.selectedIndex) {
                currentTabsElem.selectedIndex(selectedIndex ?? undefined);
            } else {
                currentTabsElem.readySelectedIndex = selectedIndex ?? null;
                currentTabsElem.addEventListener('ready', onViewTabsReady);
            }
        }

        return {
            tabsContainer: tabsContainerElem,
            tabs: currentTabsElem,
            replaced: true
        };
    }

    if (!tabsElem) {
        return {
            tabsContainer: tabsContainerElem,
            replaced: false
        };
    }

    tabsElem.selectedIndex(selectedIndex ?? undefined);

    return {
        tabsContainer: tabsContainerElem,
        tabs: tabsElem,
        replaced: false
    };
}

export function selectedTabIndex(index?: number | null): void {
    const currentTabsElem = tabsElem;
    if (!currentTabsElem) {
        return;
    }

    if (index != null) {
        currentTabsElem.selectedIndex(index);
    } else {
        currentTabsElem.triggerTabChange();
    }
}

export function getTabsElement(): HTMLElement | null {
    return document.querySelector('.tabs-viewmenubar');
}
