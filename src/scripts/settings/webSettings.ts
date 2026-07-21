import DefaultConfig from '../../config.json';
import fetchLocal from '../../utils/fetchLocal';

interface ConfigData {
    includeCorsCredentials?: boolean;
    multiserver?: boolean;
    servers?: string[];
    themes?: Array<{ name: string; id: string; default?: boolean }>;
    menuLinks?: Array<{ name: string; url: string }>;
    plugins?: string[];
}

let data: ConfigData | undefined;

async function getConfig(): Promise<ConfigData> {
    if (data) return Promise.resolve(data);
    try {
        const response = await fetchLocal('config.json', {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error('network response was not ok');
        }

        data = await response.json() as ConfigData;

        return data;
    } catch (error) {
        console.warn('failed to fetch the web config file:', error);
        data = DefaultConfig as unknown as ConfigData;
        return data;
    }
}

export function getIncludeCorsCredentials(): Promise<boolean> {
    return getConfig()
        .then(config => !!config.includeCorsCredentials)
        .catch(error => {
            console.warn('cannot get web config:', error);
            return false;
        });
}

export function getMultiServer(): Promise<boolean> {
    // Enable multi-server support when served by webpack
    if (__WEBPACK_SERVE__) {
        return Promise.resolve(true);
    }

    return getConfig().then(config => {
        return !!config.multiserver;
    }).catch(error => {
        console.warn('cannot get web config:', error);
        return false;
    });
}

export function getServers(): Promise<string[]> {
    return getConfig().then(config => {
        return config.servers || [];
    }).catch(error => {
        console.warn('cannot get web config:', error);
        return [];
    });
}

interface Theme {
    name: string;
    id: string;
    default?: boolean;
}

const baseDefaultTheme: Theme = {
    'name': 'Dark',
    'id': 'dark',
    'default': true
};

let internalDefaultTheme: Theme = baseDefaultTheme;

const checkDefaultTheme = (themes?: Theme[]): void => {
    if (themes) {
        const defaultTheme = themes.find((theme) => theme.default);

        if (defaultTheme) {
            internalDefaultTheme = defaultTheme;
            return;
        }
    }

    internalDefaultTheme = baseDefaultTheme;
};

export function getThemes(): Promise<Theme[]> {
    return getConfig().then(config => {
        if (!Array.isArray(config.themes)) {
            console.error('web config is invalid, missing themes:', config);
        }
        const themes: Theme[] = Array.isArray(config.themes) ? (config.themes as Theme[]) : DefaultConfig.themes as unknown as Theme[];
        checkDefaultTheme(themes);
        return themes;
    }).catch(error => {
        console.warn('cannot get web config:', error);
        checkDefaultTheme();
        return DefaultConfig.themes as unknown as Theme[];
    });
}

export const getDefaultTheme = (): Theme => internalDefaultTheme;

interface MenuLink {
    name: string;
    url: string;
}

export function getMenuLinks(): Promise<MenuLink[]> {
    return getConfig().then(config => {
        if (!config.menuLinks) {
            console.error('web config is invalid, missing menuLinks:', config);
        }
        return config.menuLinks || [];
    }).catch(error => {
        console.warn('cannot get web config:', error);
        return [];
    });
}

export function getPlugins(): Promise<string[]> {
    return getConfig().then(config => {
        if (!config.plugins) {
            console.error('web config is invalid, missing plugins:', config);
        }
        return config.plugins || DefaultConfig.plugins;
    }).catch(error => {
        console.warn('cannot get web config:', error);
        return DefaultConfig.plugins;
    });
}
