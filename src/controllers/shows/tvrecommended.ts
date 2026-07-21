import autoFocuser from 'components/autoFocuser';
import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getBackdropShape } from 'components/cardbuilder/utils/shape';
import layoutManager from 'components/layoutManager';
import loading from 'components/loading/loading';
import * as mainTabsManager from 'components/maintabsmanager';
import { playbackManager } from 'components/playback/playbackmanager';
import dom from 'utils/dom';
import globalize from 'lib/globalize';
import inputManager from 'scripts/inputManager';
import libraryMenu from 'scripts/libraryMenu';
import * as userSettings from 'scripts/settings/userSettings';
import { LibraryTab } from 'types/libraryTab';
import Dashboard from 'utils/dashboard';
import Events from 'utils/events';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';

import 'elements/emby-itemscontainer/emby-itemscontainer';
import 'elements/emby-button/emby-button';

import 'styles/scrollstyles.scss';

interface ViewParams {
    topParentId: string;
    tab?: string;
}

function getTabs(): { name: string }[] {
    return [{
        name: globalize.translate('Shows')
    }, {
        name: globalize.translate('Suggestions')
    }, {
        name: globalize.translate('TabUpcoming')
    }, {
        name: globalize.translate('Genres')
    }, {
        name: globalize.translate('TabNetworks')
    }, {
        name: globalize.translate('Episodes')
    }];
}

function getDefaultTabIndex(folderId: string): number {
    switch (userSettings.get('landing-' + folderId)) {
        case LibraryTab.Suggestions:
            return 1;

        case LibraryTab.Upcoming:
            return 2;

        case LibraryTab.Genres:
            return 3;

        case LibraryTab.Studios:
            return 4;

        case LibraryTab.Episodes:
            return 5;

        default:
            return 0;
    }
}

function setScrollClasses(elem: HTMLElement, scrollX: boolean): void {
    if (scrollX) {
        elem.classList.add('hiddenScrollX');

        if (layoutManager.tv) {
            elem.classList.add('smoothScrollX');
        }

        elem.classList.add('scrollX');
        elem.classList.remove('vertical-wrap');
    } else {
        elem.classList.remove('hiddenScrollX');
        elem.classList.remove('smoothScrollX');
        elem.classList.remove('scrollX');
        elem.classList.add('vertical-wrap');
    }
}

function initSuggestedTab(page: HTMLElement, tabContent: HTMLElement): void {
    const containers = tabContent.querySelectorAll('.itemsContainer');

    for (let i = 0, length = containers.length; i < length; i++) {
        setScrollClasses(containers[i] as HTMLElement, enableScrollX());
    }
}

function loadSuggestionsTab(view: HTMLElement, params: ViewParams, tabContent: HTMLElement): void {
    const parentId = params.topParentId;
    const userId = ApiClient.getCurrentUserId();
    console.debug('loadSuggestionsTab');
    loadResume(tabContent, userId, parentId);
    loadLatest(tabContent, userId, parentId);
    loadNextUp(tabContent, userId, parentId);
}

function loadResume(view: HTMLElement, userId: string, parentId: string): void {
    const screenWidth = dom.getWindowSize().innerWidth;
    const options = {
        SortBy: 'DatePlayed',
        SortOrder: 'Descending',
        IncludeItemTypes: 'Episode',
        Filters: 'IsResumable',
        Limit: screenWidth >= 1600 ? 5 : 3,
        Recursive: true,
        Fields: 'PrimaryImageAspectRatio,MediaSourceCount',
        CollapseBoxSetItems: false,
        ParentId: parentId,
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
        EnableTotalRecordCount: false
    };
    ApiClient.getItems(userId, options).then(function (result: any) {
        if (result.Items.length) {
            view.querySelector('#resumableSection')!.classList.remove('hide');
        } else {
            view.querySelector('#resumableSection')!.classList.add('hide');
        }

        const allowBottomPadding = !enableScrollX();
        const container = view.querySelector('#resumableItems');
        cardBuilder.buildCards(result.Items, {
            itemsContainer: container,
            preferThumb: true,
            inheritThumb: !userSettings.useEpisodeImagesInNextUpAndResume(),
            shape: getBackdropShape(enableScrollX()),
            scalable: true,
            overlayPlayButton: true,
            allowBottomPadding: allowBottomPadding,
            cardLayout: false,
            showTitle: true,
            showYear: true,
            centerText: true
        });
        loading.hide();

        autoFocuser.autoFocus(view);
    });
}

function loadLatest(view: HTMLElement, userId: string, parentId: string): void {
    const options = {
        userId: userId,
        IncludeItemTypes: 'Episode',
        Limit: 30,
        Fields: 'PrimaryImageAspectRatio',
        ParentId: parentId,
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Thumb'
    };
    ApiClient.getLatestItems(options).then(function (items: any[]) {
        const section = view.querySelector('#latestItemsSection') as HTMLElement;
        const allowBottomPadding = !enableScrollX();
        const container = section.querySelector('#latestEpisodesItems');
        cardBuilder.buildCards(items, {
            parentContainer: section,
            itemsContainer: container,
            items: items,
            shape: 'backdrop',
            preferThumb: true,
            showTitle: true,
            showSeriesYear: true,
            showParentTitle: true,
            overlayText: false,
            cardLayout: false,
            allowBottomPadding: allowBottomPadding,
            showUnplayedIndicator: false,
            showChildCountIndicator: true,
            centerText: true,
            lazy: true,
            overlayPlayButton: true,
            lines: 2
        });
        loading.hide();

        autoFocuser.autoFocus(view);
    });
}

function loadNextUp(view: HTMLElement, userId: string, parentId: string): void {
    const query: any = {
        userId: userId,
        Limit: 24,
        Fields: 'PrimaryImageAspectRatio,DateCreated,MediaSourceCount',
        ParentId: parentId,
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Thumb',
        EnableTotalRecordCount: false
    };
    query.ParentId = libraryMenu.getTopParentId();
    ApiClient.getNextUpEpisodes(query).then(function (result: any) {
        if (result.Items.length) {
            view.querySelector('.noNextUpItems')!.classList.add('hide');
        } else {
            view.querySelector('.noNextUpItems')!.classList.remove('hide');
        }

        const section = view.querySelector('#nextUpItemsSection') as HTMLElement;
        const container = section.querySelector('#nextUpItems');
        cardBuilder.buildCards(result.Items, {
            parentContainer: section,
            itemsContainer: container,
            preferThumb: true,
            inheritThumb: !userSettings.useEpisodeImagesInNextUpAndResume(),
            shape: 'backdrop',
            scalable: true,
            showTitle: true,
            showParentTitle: true,
            overlayText: false,
            centerText: true,
            overlayPlayButton: true,
            cardLayout: false
        });
        loading.hide();

        autoFocuser.autoFocus(view);
    });
}

function enableScrollX(): boolean {
    return !layoutManager.desktop;
}

export default function (this: any, view: HTMLElement, params: ViewParams): void {
    function onBeforeTabChange(e: any): void {
        preLoadTab(view, parseInt(e.detail.selectedTabIndex, 10));
    }

    function onTabChange(e: any): void {
        const newIndex = parseInt(e.detail.selectedTabIndex, 10);
        loadTab(view, newIndex);
    }

    function getTabContainers(): NodeListOf<HTMLElement> {
        return view.querySelectorAll('.pageTabContent');
    }

    function initTabs(): void {
        mainTabsManager.setTabs(view, currentTabIndex, getTabs, getTabContainers, onBeforeTabChange, onTabChange);
    }

    function getTabController(page: HTMLElement, index: number, callback: (controller: any) => void): void {
        let depends: string = 'tvshows';

        switch (index) {
            case 0:
                depends = 'tvshows';
                break;

            case 1:
                depends = 'tvrecommended';
                break;

            case 2:
                depends = 'tvupcoming';
                break;

            case 3:
                depends = 'tvgenres';
                break;

            case 4:
                depends = 'tvstudios';
                break;

            case 5:
                depends = 'episodes';
                break;
        }

        import(`../shows/${depends}.ts`).then(({ default: ControllerFactory }) => {
            let tabContent: HTMLElement;

            if (index === 1) {
                tabContent = view.querySelector(`.pageTabContent[data-index='${index}']`) as HTMLElement;
                self.tabContent = tabContent;
            }

            let controller = tabControllers[index];

            if (!controller) {
                tabContent = view.querySelector(`.pageTabContent[data-index='${index}']`) as HTMLElement;

                if (index === 1) {
                    controller = self;
                } else {
                    controller = new ControllerFactory(view, params, tabContent);
                }

                tabControllers[index] = controller;

                if (controller.initTab) {
                    controller.initTab();
                }
            }

            callback(controller);
        });
    }

    function preLoadTab(page: HTMLElement, index: number): void {
        getTabController(page, index, function (controller: any) {
            if (renderedTabs.indexOf(index) == -1 && controller.preRender) {
                controller.preRender();
            }
        });
    }

    function loadTab(page: HTMLElement, index: number): void {
        currentTabIndex = index;
        getTabController(page, index, function (controller: any) {
            if (renderedTabs.indexOf(index) == -1) {
                renderedTabs.push(index);
                controller.renderTab();
            }
        });
    }

    function onPlaybackStop(e: any, state: any): void {
        if (state.NowPlayingItem && state.NowPlayingItem.MediaType == 'Video') {
            renderedTabs = [];
            (mainTabsManager.getTabsElement() as any).triggerTabChange();
        }
    }

    function onUserDataChanged({ Data }: any): void {
        if (Data?.UserId == ApiClient.getCurrentUserId()) {
            renderedTabs = [];
        }
    }

    function onInputCommand(e: Event): void {
        if ((e as any).detail.command === 'search') {
            e.preventDefault();
            Dashboard.navigate(`search?collectionType=${CollectionType.Tvshows}&parentId=${params.topParentId}`);
        }
    }

    const self = this;
    let currentTabIndex = parseInt(String(params.tab || getDefaultTabIndex(params.topParentId)), 10);
    const suggestionsTabIndex = 1;

    self.initTab = function (): void {
        const tabContent = view.querySelector(`.pageTabContent[data-index='${suggestionsTabIndex}']`) as HTMLElement;
        initSuggestedTab(view, tabContent);
    };

    self.renderTab = function (): void {
        const tabContent = view.querySelector(`.pageTabContent[data-index='${suggestionsTabIndex}']`) as HTMLElement;
        loadSuggestionsTab(view, params, tabContent);
    };

    const tabControllers: any[] = [];
    let renderedTabs: number[] = [];
    view.addEventListener('viewshow', function () {
        initTabs();
        if (!view.getAttribute('data-title')) {
            const parentId = params.topParentId;

            if (parentId) {
                ApiClient.getItem(ApiClient.getCurrentUserId(), parentId).then(function (item: any) {
                    view.setAttribute('data-title', item.Name);
                    libraryMenu.setTitle(item.Name);
                });
            } else {
                view.setAttribute('data-title', globalize.translate('Shows'));
                libraryMenu.setTitle(globalize.translate('Shows'));
            }
        }

        Events.on(playbackManager, 'playbackstop', onPlaybackStop);
        self._unsubscribeUserData = ApiClient.subscribe([OutboundWebSocketMessageType.UserDataChanged], onUserDataChanged);
        inputManager.on(window, onInputCommand);
    });
    view.addEventListener('viewbeforehide', function () {
        inputManager.off(window, onInputCommand);
        Events.off(playbackManager, 'playbackstop', onPlaybackStop);
        self._unsubscribeUserData?.();
        self._unsubscribeUserData = null;
    });
    view.addEventListener('viewdestroy', function () {
        tabControllers.forEach(function (t: any) {
            if (t.destroy) {
                t.destroy();
            }
        });
    });
}
