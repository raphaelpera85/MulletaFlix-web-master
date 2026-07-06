import React, { type FC } from 'react';

import { useUserSettings } from 'hooks/useUserSettings';
import { useBrandingOptions } from 'apps/dashboard/features/branding/api/useBrandingOptions';

const importPattern = /@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?\s*;?/gi;

function splitCustomCss(css: string) {
    const importedUrls: string[] = [];
    const remainingCss = css.replace(importPattern, (_match, url: string) => {
        if (!importedUrls.includes(url)) {
            importedUrls.push(url);
        }

        return '';
    });

    return {
        importedUrls,
        remainingCss: remainingCss.trim()
    };
}

const CustomCss: FC = () => {
    const { data: brandingOptions } = useBrandingOptions();
    const { customCss: userCustomCss, disableCustomCss } = useUserSettings();
    const brandingCss = !disableCustomCss ? brandingOptions?.CustomCss : undefined;
    const customCss = [ brandingCss, userCustomCss ].filter(Boolean).join('\n');
    const { importedUrls, remainingCss } = customCss ? splitCustomCss(customCss) : { importedUrls: [], remainingCss: '' };

    return (
        <>
            {importedUrls.map(url => (
                <link
                    key={url}
                    rel='stylesheet'
                    href={url}
                />
            ))}
            {remainingCss && (
                <style>
                    {remainingCss}
                </style>
            )}
        </>
    );
};

export default CustomCss;
