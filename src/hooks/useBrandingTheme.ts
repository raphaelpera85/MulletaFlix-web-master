import { useMemo } from 'react';

import { useBrandingOptions } from 'apps/dashboard/features/branding/api/useBrandingOptions';

import { useThemes } from './useThemes';

type BrandingThemeOptions = {
    DefaultTheme?: string;
};

export function useBrandingTheme() {
    const { data: brandingOptions } = useBrandingOptions();
    const { themes, defaultTheme } = useThemes();
    const brandingDefaultTheme = (brandingOptions as BrandingThemeOptions | undefined)?.DefaultTheme;

    const brandingTheme = useMemo(() => {
        return themes.find(theme => theme.id === brandingDefaultTheme);
    }, [ brandingDefaultTheme, themes ]);

    return {
        defaultTheme: brandingTheme || defaultTheme,
        defaultThemeId: brandingTheme?.id || defaultTheme?.id
    };
}
