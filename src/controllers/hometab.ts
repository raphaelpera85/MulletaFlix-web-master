import type { ApiClient } from 'jellyfin-apiclient';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';

import * as userSettings from '../scripts/settings/userSettings';
import focusManager from '../components/focusManager';
import homeSections from '../components/homesections/homesections';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import Events from '../utils/events';
import { EventType } from '../constants/eventType';

import '../elements/emby-itemscontainer/emby-itemscontainer';

class HomeTab {
    view: HTMLElement;
    params: Record<string, unknown>;
    apiClient: ApiClient | null;
    sectionsContainer: HTMLElement | null;
    sectionsRendered: boolean;
    paused: boolean;
    private _onThemeChange: () => void;

    constructor(view: HTMLElement, params: Record<string, unknown>) {
        this.view = view;
        this.params = params;
        this.apiClient = ServerConnections.currentApiClient() as unknown as ApiClient | null;
        this.sectionsContainer = view.querySelector<HTMLElement>('.sections');
        this.sectionsRendered = false;
        this.paused = false;
        this._onThemeChange = this.onThemeChange.bind(this);

        view.querySelector('.sections')!.addEventListener('settingschange', onHomeScreenSettingsChanged.bind(this));
        Events.on(document, EventType.THEME_CHANGE, this._onThemeChange);
    }

    onResume(options: { refresh?: boolean; autoFocus?: boolean }): Promise<unknown> {
        if (this.sectionsRendered) {
            const sectionsContainer = this.sectionsContainer;

            if (sectionsContainer) {
                return homeSections.resume(sectionsContainer, options);
            }

            return Promise.resolve();
        }

        const view = this.view;
        const apiClient = this.apiClient!;
        const isNetflixTheme: boolean = document.documentElement.getAttribute('data-theme') === 'netflix';
        this.destroyHomeSections();
        this.sectionsRendered = true;
        return (apiClient as unknown as { getCurrentUser: () => Promise<UserDto> }).getCurrentUser()
            .then((user) => homeSections.loadSections(view.querySelector('.sections')!, apiClient, user, userSettings, {
                netflix: isNetflixTheme
            }))
            .then(() => {
                if (options.autoFocus) {
                    focusManager.autoFocus(view);
                }
            }).catch((err: unknown) => {
                console.error(err);
            });
    }

    onPause(): void {
        const sectionsContainer = this.sectionsContainer;

        if (sectionsContainer) {
            homeSections.pause(sectionsContainer);
        }
    }

    destroy(): void {
        this.view = null as unknown as HTMLElement;
        this.params = null as unknown as Record<string, unknown>;
        this.apiClient = null;
        Events.off(document, EventType.THEME_CHANGE, this._onThemeChange);
        this.destroyHomeSections();
        this.sectionsContainer = null;
    }

    onThemeChange(): void {
        this.sectionsRendered = false;

        if (!this.paused) {
            this.onResume({
                refresh: true
            });
        }
    }

    destroyHomeSections(): void {
        const sectionsContainer = this.sectionsContainer;

        if (sectionsContainer) {
            homeSections.destroySections(sectionsContainer);
        }
    }
}

function onHomeScreenSettingsChanged(this: HomeTab): void {
    this.sectionsRendered = false;

    if (!this.paused) {
        this.onResume({
            refresh: true
        });
    }
}

export default HomeTab;
