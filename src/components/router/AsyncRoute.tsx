import type { RouteObject } from 'react-router-dom';

import { AppType } from 'constants/appType';

export interface AsyncRoute {
    /** The URL path for this route. */
    path: string
    /**
     * The relative path to the page component in the routes directory.
     * Will fallback to using the `path` value if not specified.
     */
    page?: string
    /** The app that this page is part of. */
    type?: AppType
}

const dashboardModules = import.meta.glob('../../apps/dashboard/routes/**/*.tsx');
const experimentalModules = import.meta.glob('../../apps/experimental/routes/**/*.tsx');
const stableModules = import.meta.glob('../../apps/stable/routes/**/*.tsx');

const importRoute = (page: string, type: AppType): Promise<any> => {
    const key1 = `../../apps/dashboard/routes/${page}.tsx`;
    const key2 = `../../apps/dashboard/routes/${page}/index.tsx`;
    const key3 = `../../apps/experimental/routes/${page}.tsx`;
    const key4 = `../../apps/experimental/routes/${page}/index.tsx`;
    const key5 = `../../apps/stable/routes/${page}.tsx`;
    const key6 = `../../apps/stable/routes/${page}/index.tsx`;

    if (type === AppType.Dashboard) {
        const loader = dashboardModules[key1] || dashboardModules[key2];
        if (loader) return loader();
    } else if (type === AppType.Experimental) {
        const loader = experimentalModules[key3] || experimentalModules[key4];
        if (loader) return loader();
    } else if (type === AppType.Stable) {
        const loader = stableModules[key5] || stableModules[key6];
        if (loader) return loader();
    }

    throw new Error(`Route component not found for page: ${page} with type: ${type}`);
};

export const toAsyncPageRoute = ({
    path,
    page,
    type = AppType.Stable
}: AsyncRoute): RouteObject => {
    return {
        path,
        lazy: async () => {
            const {
                // If there is a default export, use it as the Component for compatibility
                default: Component,
                ...route
            } = await importRoute(page ?? path, type);

            return {
                Component,
                ...route
            };
        }
    };
};
