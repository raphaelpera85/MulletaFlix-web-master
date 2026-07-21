import Events from 'utils/events';
import { EventType } from 'constants/eventType';

import { getDefaultTheme, getThemes as getConfiguredThemes } from './settings/webSettings';

let currentThemeId: string | undefined;

interface ThemeInfo {
    id: string;
    color: string;
    name?: string;
    [key: string]: any;
}

function getThemes(): Promise<ThemeInfo[]> {
    return getConfiguredThemes() as Promise<ThemeInfo[]>;
}

function getThemeStylesheetInfo(id: string): Promise<ThemeInfo> {
    return getThemes().then(themes => {
        let theme: ThemeInfo | undefined;

        if (id) {
            theme = themes.find(currentTheme => {
                return currentTheme.id === id;
            });
        }

        if (!theme) {
            theme = getDefaultTheme() as ThemeInfo;
        }

        return theme;
    });
}

function setTheme(id: string): Promise<void> {
    return new Promise(function (resolve) {
        if (currentThemeId && currentThemeId === id) {
            resolve();
            return;
        }

        getThemeStylesheetInfo(id).then(function (info) {
            if (currentThemeId && currentThemeId === info.id) {
                resolve();
                return;
            }

            currentThemeId = info.id;

            // set the theme attribute for mui
            document.documentElement.setAttribute('data-theme', info.id);

            // set the meta theme color
            (document.getElementById('themeColor') as HTMLMetaElement).content = info.color;

            Events.trigger(document, EventType.THEME_CHANGE, [ info.id ]);
        });
    });
}

export default {
    getThemes,
    setTheme
};
