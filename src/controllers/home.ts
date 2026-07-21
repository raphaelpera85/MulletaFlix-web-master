import TabbedView from '../components/tabbedview/tabbedview';
import globalize from '../lib/globalize';
import '../elements/emby-tabs/emby-tabs';
import '../elements/emby-button/emby-button';
import '../elements/emby-scroller/emby-scroller';
import LibraryMenu from '../scripts/libraryMenu';
import { ServerConnections } from '../lib/jellyfin-apiclient';
import { showAdSenseInterstitial } from '../components/branding/adsense';

const controllerModules: Record<string, () => Promise<{ default: new (view: HTMLElement, params: Record<string, unknown>) => unknown }>> =
    import.meta.glob('../controllers/*.ts') as Record<string, () => Promise<{ default: new (view: HTMLElement, params: Record<string, unknown>) => unknown }>>;

class HomeView extends TabbedView {
    declare tabControllers: Array<{ onResume?: (options?: Record<string, unknown>) => void; onPause?: () => void; destroy?: () => void; refreshed?: boolean }>;

    setTitle(): void {
        LibraryMenu.setTitle(null);
    }

    override onPause(): void {
        super.onPause();
        document.querySelector('.skinHeader')!.classList.remove('noHomeButtonHeader');
    }

    onResume(options?: Record<string, unknown>): void {
        super.onResume();
        document.querySelector('.skinHeader')!.classList.add('noHomeButtonHeader');

        const apiClient = ServerConnections.currentApiClient();
        if (apiClient) {
            void showAdSenseInterstitial(apiClient, 'home');
        }
    }

    override getDefaultTabIndex(): string {
        return '0';
    }

    getTabs = (): Array<{ name: string }> => {
        return [{
            name: globalize.translate('Home')
        }, {
            name: globalize.translate('Favorites')
        }];
    };

    override getTabController(index: number): Promise<{ onResume?: (options?: Record<string, unknown>) => void; onPause?: () => void; destroy?: () => void; refreshed?: boolean }> {
        if (index == null) {
            throw new Error('index cannot be null');
        }

        let depends: string = '';

        switch (index) {
            case 0:
                depends = 'hometab';
                break;

            case 1:
                depends = 'favorites';
        }

        const instance = this;
        const globPath: string = `../controllers/${depends}.ts`;
        const loadFn = controllerModules[globPath];
        if (!loadFn) {
            return Promise.reject(new Error(`Controller not found in glob: ${depends}`));
        }
        return loadFn().then(({ default: ControllerFactory }) => {
            let controller = instance.tabControllers[index] as (InstanceType<typeof ControllerFactory> & Record<string, unknown>) | undefined;

            if (!controller) {
                controller = new ControllerFactory(
                    instance.view.querySelector<HTMLElement>(".tabContent[data-index='" + index + "']")!,
                    instance.params as Record<string, unknown>
                ) as InstanceType<typeof ControllerFactory> & Record<string, unknown>;
                instance.tabControllers[index] = controller;
            }

            return controller as { onResume?: (options?: Record<string, unknown>) => void; onPause?: () => void; destroy?: () => void; refreshed?: boolean };
        });
    }
}

export default HomeView;
