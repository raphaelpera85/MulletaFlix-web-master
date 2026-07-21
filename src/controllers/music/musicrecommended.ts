import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getSquareShape } from 'components/cardbuilder/utils/shape';
import imageLoader from 'components/images/imageLoader';
import layoutManager from 'components/layoutManager';
import loading from 'components/loading/loading';
import * as mainTabsManager from 'components/maintabsmanager';
import browser from 'scripts/browser';
import dom from 'utils/dom';
import globalize from 'lib/globalize';
import inputManager from 'scripts/inputManager';
import libraryMenu from 'scripts/libraryMenu';
import * as userSettings from 'scripts/settings/userSettings';
import { LibraryTab } from 'types/libraryTab';
import Dashboard from 'utils/dashboard';

import 'elements/emby-itemscontainer/emby-itemscontainer';
import 'elements/emby-tabs/emby-tabs';
import 'elements/emby-button/emby-button';

import 'styles/flexstyles.scss';
import 'styles/scrollstyles.scss';

function itemsPerRow(): number {
    const screenWidth = dom.getWindowSize().innerWidth;

    if (screenWidth >= 1920) {
        return 9;
    }

    if (screenWidth >= 1200) {
        return 12;
    }

    if (screenWidth >= 1000) {
        return 10;
    }

    return 8;
}

function enableScrollX(): boolean {
    return !layoutManager.desktop;
}

function loadLatest(page: HTMLElement, parentId: string): void {
    loading.show();
    const userId = ApiClient.getCurrentUserId();
    const options = {
        IncludeItemTypes: 'Audio',
        Limit: enableScrollX() ? 3 * itemsPerRow() : 2 * itemsPerRow(),
        Fields: 'PrimaryImageAspectRatio',
        ParentId: parentId,
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
        EnableTotalRecordCount: false
    };
    ApiClient.getJSON(ApiClient.getUrl('Users/' + userId + '/Items/Latest', options)).then(function (items: any[]) {
        const elem = page.querySelector('#recentlyAddedSongs')!;
        elem.innerHTML = cardBuilder.getCardsHtml({
            items: items,
            showUnplayedIndicator: false,
            showLatestItemsPopup: false,
            shape: getSquareShape(enableScrollX()),
            showTitle: true,
            showParentTitle: true,
            lazy: true,
            centerText: true,
            overlayPlayButton: true,
            allowBottomPadding: !enableScrollX(),
            cardLayout: false,
            coverImage: true
        });
        imageLoader.lazyChildren(elem);
        loading.hide();

        import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
            autoFocuser.autoFocus(page);
        });
    });
}

function loadRecentlyPlayed(page: HTMLElement, parentId: string): void {
    const options = {
        SortBy: 'DatePlayed',
        SortOrder: 'Descending',
        IncludeItemTypes: 'Audio',
        Limit: itemsPerRow(),
        Recursive: true,
        Fields: 'PrimaryImageAspectRatio',
        Filters: 'IsPlayed',
        ParentId: parentId,
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
        EnableTotalRecordCount: false
    };
    ApiClient.getItems(ApiClient.getCurrentUserId(), options).then(function (result: any) {
        const elem = page.querySelector('#recentlyPlayed')!;

        if (result.Items.length) {
            elem.classList.remove('hide');
        } else {
            elem.classList.add('hide');
        }

        const itemsContainer = elem.querySelector('.itemsContainer')!;
        itemsContainer.innerHTML = cardBuilder.getCardsHtml({
            items: result.Items,
            showUnplayedIndicator: false,
            shape: getSquareShape(enableScrollX()),
            showTitle: true,
            showParentTitle: true,
            action: 'instantmix',
            lazy: true,
            centerText: true,
            overlayMoreButton: true,
            allowBottomPadding: !enableScrollX(),
            cardLayout: false,
            coverImage: true
        });
        imageLoader.lazyChildren(itemsContainer);
    });
}

function loadFrequentlyPlayed(page: HTMLElement, parentId: string): void {
    const options = {
        SortBy: 'PlayCount',
        SortOrder: 'Descending',
        IncludeItemTypes: 'Audio',
        Limit: itemsPerRow(),
        Recursive: true,
        Fields: 'PrimaryImageAspectRatio',
        Filters: 'IsPlayed',
        ParentId: parentId,
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
        EnableTotalRecordCount: false
    };
    ApiClient.getItems(ApiClient.getCurrentUserId(), options).then(function (result: any) {
        const elem = page.querySelector('#topPlayed')!;

        if (result.Items.length) {
            elem.classList.remove('hide');
        } else {
            elem.classList.add('hide');
        }

        const itemsContainer = elem.querySelector('.itemsContainer')!;
        itemsContainer.innerHTML = cardBuilder.getCardsHtml({
            items: result.Items,
            showUnplayedIndicator: false,
            shape: getSquareShape(enableScrollX()),
            showTitle: true,
            showParentTitle: true,
            action: 'instantmix',
            lazy: true,
            centerText: true,
            overlayMoreButton: true,
            allowBottomPadding: !enableScrollX(),
            cardLayout: false,
            coverImage: true
        });
        imageLoader.lazyChildren(itemsContainer);
    });
}

function loadSuggestionsTab(page: HTMLElement, tabContent: HTMLElement, parentId: string): void {
    console.debug('loadSuggestionsTab');
    loadLatest(tabContent, parentId);
    loadRecentlyPlayed(tabContent, parentId);
    loadFrequentlyPlayed(tabContent, parentId);

    import('../../components/favoriteitems').then(({ default: favoriteItems }) => {
        favoriteItems.render(tabContent, ApiClient.getCurrentUserId(), parentId, ['favoriteArtists', 'favoriteAlbums', 'favoriteSongs'].join(','));
    });
}

function getTabs(): Array<{ name: string }> {
    return [{
        name: globalize.translate('Albums')
    }, {
        name: globalize.translate('Suggestions')
    }, {
        name: globalize.translate('HeaderAlbumArtists')
    }, {
        name: globalize.translate('Artists')
    }, {
        name: globalize.translate('Playlists')
    }, {
        name: globalize.translate('Songs')
    }, {
        name: globalize.translate('Genres')
    }];
}

function getDefaultTabIndex(folderId: string): number {
    switch (userSettings.get('landing-' + folderId)) {
        case LibraryTab.Suggestions:
            return 1;

        case LibraryTab.AlbumArtists:
            return 2;

        case LibraryTab.Artists:
            return 3;

        case LibraryTab.Playlists:
            return 4;

        case LibraryTab.Songs:
            return 5;

        case LibraryTab.Genres:
            return 6;

        default:
            return 0;
    }
}

interface TabController {
    initTab?: () => void;
    renderTab: () => void;
    preRender?: () => void;
    destroy?: () => void;
}

interface RecommendedController extends TabController {
    tabContent?: HTMLElement;
}

export default function (this: RecommendedController, view: HTMLElement, params: { topParentId: string; tab?: string }) {
    function reload(): void {
        loading.show();
        const tabContent = view.querySelector(".pageTabContent[data-index='" + suggestionsTabIndex + "']") as HTMLElement;
        loadSuggestionsTab(view, tabContent, params.topParentId);
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

    function onBeforeTabChange(e: CustomEvent): void {
        preLoadTab(view, parseInt(e.detail.selectedTabIndex, 10));
    }

    function onTabChange(e: CustomEvent): void {
        loadTab(view, parseInt(e.detail.selectedTabIndex, 10));
    }

    function getTabContainers(): NodeListOf<HTMLElement> {
        return view.querySelectorAll('.pageTabContent');
    }

    function initTabs(): void {
        mainTabsManager.setTabs(view, currentTabIndex, getTabs, getTabContainers, onBeforeTabChange, onTabChange);
    }

    function getMode(index: number): string | undefined {
        if (index === 2) {
            return 'albumartists';
        } else if (index === 3) {
            return 'artists';
        }
        return undefined;
    }

    const getTabController = (page: HTMLElement, index: number, callback: (controller: TabController) => void): void => {
        let depends = '';

        switch (index) {
            case 0:
                depends = 'musicalbums';
                break;

            case 1:
                depends = 'musicrecommended';
                break;

            case 2:
            case 3:
                depends = 'musicartists';
                break;

            case 4:
                depends = 'musicplaylists';
                break;

            case 5:
                depends = 'songs';
                break;

            case 6:
                depends = 'musicgenres';
                break;
        }

        import(`../music/${depends}.ts`).then(({ default: ControllerFactory }) => {
            let tabContent: HTMLElement;

            if (index == 1) {
                tabContent = view.querySelector(".pageTabContent[data-index='" + index + "']") as HTMLElement;
                this.tabContent = tabContent;
            }

            let controller: TabController = tabControllers[index];

            if (!controller) {
                tabContent = view.querySelector(".pageTabContent[data-index='" + index + "']") as HTMLElement;

                if (index === 1) {
                    controller = this;
                } else {
                    controller = new (ControllerFactory as any)(view, params, tabContent, {
                        mode: getMode(index)
                    });
                }

                tabControllers[index] = controller;
                if (controller.initTab) {
                    controller.initTab();
                }
            }

            callback(controller);
        });
    };

    function preLoadTab(page: HTMLElement, index: number): void {
        getTabController(page, index, function (controller: TabController) {
            if (renderedTabs.indexOf(index) == -1 && controller.preRender) {
                controller.preRender();
            }
        });
    }

    function loadTab(page: HTMLElement, index: number): void {
        currentTabIndex = index;
        getTabController(page, index, function (controller: TabController) {
            if (renderedTabs.indexOf(index) == -1) {
                renderedTabs.push(index);
                controller.renderTab();
            }
        });
    }

    const onInputCommand: EventListener = (event: Event): void => {
        const e = event as KeyboardEvent & { detail?: { command?: string } };

        if (e.detail?.command === 'search') {
            e.preventDefault();
            Dashboard.navigate('search?collectionType=music&parentId=' + params.topParentId);
        }
    };

    let currentTabIndex = parseInt(params.tab || String(getDefaultTabIndex(params.topParentId)), 10);
    const suggestionsTabIndex = 1;

    this.initTab = function () {
        const tabContent = view.querySelector(".pageTabContent[data-index='" + suggestionsTabIndex + "']") as HTMLElement;
        const containers = tabContent.querySelectorAll('.itemsContainer');

        for (let i = 0, length = containers.length; i < length; i++) {
            setScrollClasses(containers[i] as HTMLElement, browser.mobile);
        }
    };

    this.renderTab = function () {
        reload();
    };

    const tabControllers: TabController[] = [];
    const renderedTabs: number[] = [];
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
                view.setAttribute('data-title', globalize.translate('TabMusic'));
                libraryMenu.setTitle(globalize.translate('TabMusic'));
            }
        }

        inputManager.on(window, onInputCommand);
    });
    view.addEventListener('viewbeforehide', function () {
        inputManager.off(window, onInputCommand);
    });
    view.addEventListener('viewdestroy', function () {
        tabControllers.forEach(function (t) {
            if (t.destroy) {
                t.destroy();
            }
        });
    });
}
