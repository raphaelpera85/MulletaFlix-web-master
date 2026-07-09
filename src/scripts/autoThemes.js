import * as userSettings from './settings/userSettings';
import skinManager from './themeManager';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { pageClassOn } from 'utils/dashboard';
import Events from 'utils/events.ts';
import { queryClient } from 'utils/query/queryClient';
import { getBrandingOptionsQuery } from 'apps/dashboard/features/branding/api/useBrandingOptions';
import { getDefaultTheme } from './settings/webSettings';

async function getBrandingDefaultThemeId() {
    const api = ServerConnections.getCurrentApi();

    if (!api) {
        return undefined;
    }

    try {
        const brandingOptions = await queryClient.fetchQuery(getBrandingOptionsQuery(api));
        return brandingOptions.DefaultTheme || undefined;
    } catch (error) {
        console.warn('[autoThemes] failed to load branding default theme', error);
        return undefined;
    }
}

async function resolveThemeId(themeId) {
    if (themeId) {
        return themeId;
    }

    const brandingThemeId = await getBrandingDefaultThemeId();
    return brandingThemeId || getDefaultTheme().id;
}

async function applyTheme(themeId) {
    await skinManager.setTheme(await resolveThemeId(themeId));
}

// Set the default theme when loading
applyTheme(userSettings.theme())
    /* this keeps the scrollbar always present in all pages, so we avoid clipping while switching between pages
       that need the scrollbar and pages that don't.
     */
    .then(() => document.body.classList.add('force-scroll'));

// set the saved theme once a user authenticates
Events.on(ServerConnections, 'localusersignedin', () => {
    void applyTheme(userSettings.theme());
});

pageClassOn('viewbeforeshow', 'page', function () {
    if (this.classList.contains('type-interior')) {
        void applyTheme(userSettings.dashboardTheme());
    } else {
        void applyTheme(userSettings.theme());
    }
});

