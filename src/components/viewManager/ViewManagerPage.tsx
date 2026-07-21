import { Action } from 'history';
import { FunctionComponent, useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

import globalize from 'lib/globalize';
import type { RestoreViewFailResponse } from 'types/viewManager';

import viewManager from './viewManager';
import { AppType } from 'constants/appType';

export interface ViewManagerPageProps {
    appType?: AppType
    controller: string
    view: string
    type?: string
    isFullscreen?: boolean
    isNowPlayingBarEnabled?: boolean
    isThemeMediaSupported?: boolean
    transition?: string
}

interface ViewOptions {
    url: string
    type?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: any
    autoFocus: boolean
    fullscreen?: boolean
    transition?: string
    options: {
        supportsThemeMedia?: boolean
        enableMediaControl?: boolean
    }
}

const dashboardControllers = import.meta.glob([
    '../../apps/dashboard/controllers/**/*.ts',
    '../../apps/dashboard/controllers/**/*.tsx',
    '../../apps/dashboard/controllers/**/*.html'
]);

const wizardControllers = import.meta.glob([
    '../../apps/wizard/controllers/**/*.ts',
    '../../apps/wizard/controllers/**/*.tsx',
    '../../apps/wizard/controllers/**/*.html'
]);

const defaultControllers = import.meta.glob([
    '../../controllers/**/*.ts',
    '../../controllers/**/*.tsx',
    '../../controllers/**/*.html'
]);

// Separate glob for raw HTML views
const dashboardViews = import.meta.glob([
    '../../apps/dashboard/controllers/**/*.html'
], { query: '?raw', import: 'default' });

const wizardViews = import.meta.glob([
    '../../apps/wizard/controllers/**/*.html'
], { query: '?raw', import: 'default' });

const defaultViews = import.meta.glob([
    '../../controllers/**/*.html'
], { query: '?raw', import: 'default' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveModule = (glob: Record<string, () => Promise<any>>, basePath: string, name: string) => {
    const extensions = ['', '.ts', '.tsx', '.html'];
    for (const ext of extensions) {
        const path = `${basePath}/${name}${ext}`;
        const loadFn = glob[path];
        if (loadFn) {
            return loadFn().then(mod => mod.default || mod);
        }
    }
    return Promise.reject(new Error(`Module not found: ${basePath}/${name}`));
};

const importController = (
    appType: AppType,
    controller: string,
    view: string
) => {
    const resolveView = (htmlModule: any) => {
        const html = htmlModule?.default !== undefined ? htmlModule.default : htmlModule;
        if (typeof html === 'string') {
            return globalize.translateHtml(html);
        }
        console.warn('[ViewManagerPage] view module is not a string', controller, view, html);
        return '';
    };
    switch (appType) {
        case AppType.Dashboard:
            return Promise.all([
                resolveModule(dashboardControllers, '../../apps/dashboard/controllers', controller),
                resolveModule(dashboardViews, '../../apps/dashboard/controllers', view)
                    .then(resolveView)
            ]);
        case AppType.Wizard:
            return Promise.all([
                resolveModule(wizardControllers, '../../apps/wizard/controllers', controller),
                resolveModule(wizardViews, '../../apps/wizard/controllers', view)
                    .then(resolveView)
            ]);
        default:
            return Promise.all([
                resolveModule(defaultControllers, '../../controllers', controller),
                resolveModule(defaultViews, '../../controllers', view)
                    .then(resolveView)
            ]);
    }
};

const loadView = async (
    appType: AppType,
    controller: string,
    view: string,
    viewOptions: ViewOptions
) => {
    const [ controllerFactory, viewHtml ] = await importController(appType, controller, view);

    viewManager.loadView({
        ...viewOptions,
        controllerFactory,
        view: viewHtml
    });
};

/**
 * Page component that renders legacy views via the ViewManager.
 * NOTE: Any new pages should use the generic Page component instead.
 */
const ViewManagerPage: FunctionComponent<ViewManagerPageProps> = ({
    appType = AppType.Stable,
    controller,
    view,
    type,
    isFullscreen = false,
    isNowPlayingBarEnabled = true,
    isThemeMediaSupported = false,
    transition
}) => {
    const location = useLocation();
    const navigationType = useNavigationType();

    useEffect(() => {
        const loadPage = () => {
            const viewOptions = {
                url: location.pathname + location.search,
                type,
                state: location.state,
                autoFocus: false,
                fullscreen: isFullscreen,
                transition,
                options: {
                    supportsThemeMedia: isThemeMediaSupported,
                    enableMediaControl: isNowPlayingBarEnabled
                }
            };

            if (navigationType !== Action.Pop) {
                console.debug('[ViewManagerPage] loading view [%s]', view);
                return loadView(appType, controller, view, viewOptions);
            }

            console.debug('[ViewManagerPage] restoring view [%s]', view);
            return viewManager.tryRestoreView(viewOptions)
                .catch(async (result?: RestoreViewFailResponse) => {
                    if (!result?.cancelled) {
                        console.debug('[ViewManagerPage] restore failed; loading view [%s]', view);
                        return loadView(appType, controller, view, viewOptions);
                    }
                });
        };

        loadPage();
    },
    // location.state and navigationType are NOT included as dependencies here since dialogs will update state while the current view stays the same
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
        controller,
        view,
        type,
        isFullscreen,
        isNowPlayingBarEnabled,
        isThemeMediaSupported,
        transition,
        location.pathname,
        location.search
    ]);

    return null;
};

export default ViewManagerPage;
