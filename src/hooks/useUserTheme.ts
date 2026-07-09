import { useBrandingTheme } from './useBrandingTheme';
import { useUserSettings } from './useUserSettings';

export const FALLBACK_THEME_ID = 'dark';

export function useUserTheme() {
    const { theme, dashboardTheme } = useUserSettings();
    const { defaultThemeId } = useBrandingTheme();

    return {
        theme: theme || defaultThemeId || FALLBACK_THEME_ID,
        dashboardTheme: dashboardTheme || defaultThemeId || FALLBACK_THEME_ID
    };
}
