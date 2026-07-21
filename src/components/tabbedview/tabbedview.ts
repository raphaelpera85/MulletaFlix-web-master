import { clearBackdrop } from '../backdrop/backdrop';
import * as mainTabsManager from '../maintabsmanager';
import layoutManager from '../layoutManager';
import '../../elements/emby-tabs/emby-tabs';
import LibraryMenu from '../../scripts/libraryMenu';

interface TabController {
    onResume?: (options?: any) => void;
    onPause?: () => void;
    destroy?: () => void;
    refreshed?: boolean;
}

interface TabbedViewParams {
    tab?: string;
    parentId?: string;
    [key: string]: any;
}

function onViewDestroy(this: TabbedView): void {
    const tabControllers = this.tabControllers;

    if (tabControllers) {
        tabControllers.forEach(function (t) {
            if (t.destroy) {
                t.destroy();
            }
        });

        this.tabControllers = null!;
    }

    this.view = null!;
    this.params = null!;
    this.currentTabController = null;
    this.initialTabIndex = null!;
}

class TabbedView {
    tabControllers: TabController[] | null;
    view: HTMLElement;
    params: TabbedViewParams;
    currentTabController: TabController | null = null;
    initialTabIndex: number | null;
    getTabs?: any;
    validateTabLoad?: (index: number) => Promise<void>;

    constructor(view: HTMLElement, params: TabbedViewParams) {
        this.tabControllers = [];
        this.view = view;
        this.params = params;

        const self = this;

        let currentTabIndex = parseInt(params.tab || this.getDefaultTabIndex(params.parentId), 10);
        this.initialTabIndex = currentTabIndex;

        function validateTabLoad(index: number): Promise<void> {
            return self.validateTabLoad ? self.validateTabLoad(index) : Promise.resolve();
        }

        function loadTab(index: number, previousIndex: number | null): void {
            validateTabLoad(index).then(function () {
                self.getTabController(index).then(function (controller: TabController) {
                    const refresh = !controller.refreshed;

                    controller.onResume!({
                        autoFocus: previousIndex == null && layoutManager.tv,
                        refresh: refresh
                    });

                    controller.refreshed = true;

                    currentTabIndex = index;
                    self.currentTabController = controller;
                });
            });
        }

        function getTabContainers(): NodeListOf<Element> {
            return view.querySelectorAll('.tabContent');
        }

        function onTabChange(e: CustomEvent): void {
            const newIndex = parseInt((e.detail as any).selectedTabIndex, 10);
            const previousIndex = (e.detail as any).previousIndex;

            const previousTabController = previousIndex == null ? null : self.tabControllers![previousIndex];
            if (previousTabController?.onPause) {
                previousTabController.onPause();
            }

            loadTab(newIndex, previousIndex);
        }

        view.addEventListener('viewbeforehide', this.onPause.bind(this));

        view.addEventListener('viewbeforeshow', function () {
            mainTabsManager.setTabs(view, currentTabIndex, self.getTabs, getTabContainers, null, onTabChange, false);
        });

        view.addEventListener('viewshow', function (e: any) {
            self.onResume();
        });

        view.addEventListener('viewdestroy', onViewDestroy.bind(this) as EventListener);
    }

    getDefaultTabIndex(parentId?: string): string {
        return '0';
    }

    getTabController(index: number): Promise<TabController> {
        return Promise.resolve(this.tabControllers![index] || {});
    }

    onResume(): void {
        this.setTitle();
        clearBackdrop();

        const currentTabController = this.currentTabController;

        if (!currentTabController) {
            mainTabsManager.selectedTabIndex(this.initialTabIndex!);
        } else if (currentTabController?.onResume) {
            currentTabController.onResume({});
        }
    }

    onPause(): void {
        const currentTabController = this.currentTabController;

        if (currentTabController?.onPause) {
            currentTabController.onPause();
        }
    }

    setTitle(): void {
        LibraryMenu.setTitle('');
    }
}

export default TabbedView;
