import { getDisplayPreferencesQuery } from 'hooks/api/useDisplayPreferences';
import { getUserQuery } from 'hooks/api/useUser';
import { QUERY_KEY } from 'hooks/useUsers';
import { ApiClient } from 'jellyfin-apiclient';
import Events from 'utils/events';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { queryClient } from 'utils/query/queryClient';
import { toBoolean } from 'utils/string';

import browser from '../browser';
import appSettings from './appSettings';

const DISPLAY_PREFERENCES_ID = 'usersettings';
// TODO: We should really update the client ID at some point
const CLIENT_ID = 'emby';

function onSaveTimeout(this: UserSettings): void {
    this.saveTimeout = undefined;
    this.currentApiClient?.updateDisplayPreferences(DISPLAY_PREFERENCES_ID, this.displayPrefs as unknown as Record<string, unknown>, this.currentUserId as string, CLIENT_ID);
}

function saveServerPreferences(instance: UserSettings): void {
    if (instance.saveTimeout) {
        clearTimeout(instance.saveTimeout);
    }

    instance.saveTimeout = setTimeout(onSaveTimeout.bind(instance), 50) as unknown as ReturnType<typeof setTimeout>;
}

const allowedSortSettings: string[] = ['SortBy', 'SortOrder'];

const filterSettingsPostfix = '-filter';
const allowedFilterSettings: string[] = [
    'Filters', 'HasSubtitles', 'HasTrailer', 'HasSpecialFeature',
    'HasThemeSong', 'HasThemeVideo', 'Genres', 'OfficialRatings',
    'Tags', 'VideoTypes', 'IsSD', 'IsHD', 'Is4K', 'Is3D',
    'IsFavorite', 'IsMissing', 'IsUnaired', 'ParentIndexNumber',
    'SeriesStatus', 'Years'
];

function filterQuerySettings(query: Record<string, unknown>, allowedItems: string[]): Record<string, unknown> {
    return Object.keys(query)
        .filter(field => allowedItems.includes(field))
        .reduce<Record<string, unknown>>((acc, field) => {
            acc[field] = query[field];
            return acc;
        }, {});
}

const defaultSubtitleAppearanceSettings: Record<string, unknown> = {
    verticalPosition: -3
};

const defaultComicsPlayerSettings: Record<string, unknown> = {
    langDir: 'ltr',
    pagesPerView: 1
};

export class UserSettings {
    currentUserId?: string;
    currentApiClient?: ApiClient;
    displayPrefs?: Record<string, unknown> & { CustomPrefs: Record<string, string> };
    saveTimeout?: ReturnType<typeof setTimeout>;

    /**
     * Bind UserSettings instance to user.
     * @param userId - User identifier.
     * @param apiClient - ApiClient instance.
     */
    setUserInfo(userId: string | undefined, apiClient: ApiClient): Promise<void> {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.currentUserId = userId;
        this.currentApiClient = apiClient;

        if (!userId) {
            this.displayPrefs = undefined;
            return Promise.resolve();
        }

        const self = this;

        return queryClient
            .fetchQuery(getDisplayPreferencesQuery(
                toApi(apiClient),
                {
                    displayPreferencesId: DISPLAY_PREFERENCES_ID,
                    client: CLIENT_ID,
                    userId
                }
            ))
            .then((result) => {
                const prefs = result as unknown as Record<string, unknown> & { CustomPrefs: Record<string, string> };
                prefs.CustomPrefs = prefs.CustomPrefs || {};
                self.displayPrefs = prefs;
            }) as unknown as Promise<void>;
    }

    /**
     * Set value of setting.
     * @param name - Name of setting.
     * @param value - Value of setting.
     * @param enableOnServer - Flag to save preferences on server.
     */
    set(name: string, value: unknown, enableOnServer?: boolean): void {
        const userId = this.currentUserId;
        const currentValue = this.get(name, enableOnServer);
        appSettings.set(name, value as string, userId);

        if (enableOnServer !== false && this.displayPrefs) {
            this.displayPrefs.CustomPrefs[name] = value == null ? (value as unknown as string) : (value as { toString(): string }).toString();
            saveServerPreferences(this);
        }

        if (currentValue !== value) {
            Events.trigger(this, 'change', [name]);
        }
    }

    /**
     * Get value of setting.
     * @param name - Name of setting.
     * @param enableOnServer - Flag to return preferences from server (cached).
     * @return Value of setting.
     */
    get(name: string, enableOnServer?: boolean): string | null {
        const userId = this.currentUserId;
        if (enableOnServer !== false && this.displayPrefs) {
            return this.displayPrefs.CustomPrefs[name] || null;
        }

        return appSettings.get(name, userId);
    }

    /**
     * Get or set user config.
     * @param config - Configuration or undefined.
     * @return Configuration or Promise.
     */
    serverConfig(config?: Record<string, unknown>): unknown {
        const apiClient = this.currentApiClient;
        if (config) {
            return apiClient!
                .updateUserConfiguration(this.currentUserId!, config)
                .then(() => {
                    queryClient.invalidateQueries({
                        queryKey: [ QUERY_KEY, this.currentUserId ]
                    });
                });
        }

        return queryClient
            .fetchQuery(getUserQuery(toApi(apiClient!), { userId: this.currentUserId }))
            .then((user) => (user as unknown as Record<string, unknown>).Configuration);
    }

    /**
     * Get or set 'Allowed Audio Channels'.
     * @param val - 'Allowed Audio Channels'.
     * @return 'Allowed Audio Channels'.
     */
    allowedAudioChannels(val?: string): string {
        if (val !== undefined) {
            this.set('allowedAudioChannels', val, false);
            return this.get('allowedAudioChannels', false) || '-1';
        }

        return this.get('allowedAudioChannels', false) || '-1';
    }

    /**
     * Get or set 'Prefer fMP4-HLS Container' state.
     * @param val - Flag to enable 'Prefer fMP4-HLS Container' or undefined.
     * @return 'Prefer fMP4-HLS Container' state.
     */
    preferFmp4HlsContainer(val?: boolean): boolean {
        const defaultFmp4 = browser.safari || browser.firefox || (browser as unknown as Record<string, boolean>).chrome || browser.edgeChromium;
        if (val !== undefined) {
            this.set('preferFmp4HlsContainer', val.toString(), false);
            return toBoolean(this.get('preferFmp4HlsContainer', false), defaultFmp4);
        }

        // Enable it by default only for the platforms that play fMP4 for sure.
        return toBoolean(this.get('preferFmp4HlsContainer', false), defaultFmp4);
    }

    /**
     * Get or set 'Limit Segment Length' state.
     * @param val - Flag to enable 'Limit Segment Length' or undefined.
     * @returns 'Limit Segment Length' state.
     */
    limitSegmentLength(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('limitSegmentLength', val.toString(), false);
            return toBoolean(this.get('limitSegmentLength', false), false);
        }

        return toBoolean(this.get('limitSegmentLength', false), false);
    }

    /**
     * Get or set 'Cinema Mode' state.
     * @param val - Flag to enable 'Cinema Mode' or undefined.
     * @return 'Cinema Mode' state.
     */
    enableCinemaMode(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableCinemaMode', val.toString(), false);
            return toBoolean(this.get('enableCinemaMode', false), true);
        }

        return toBoolean(this.get('enableCinemaMode', false), true);
    }

    /**
     * Get or set 'Enable Audio Normalization' state.
     * @param val - Flag to enable 'Enable Audio Normalization' or undefined.
     * @return 'Enable Audio Normalization' state.
     */
    selectAudioNormalization(val?: string): string {
        if (val !== undefined) {
            this.set('selectAudioNormalization', val, false);
            return this.get('selectAudioNormalization', false) || 'TrackGain';
        }

        return this.get('selectAudioNormalization', false) || 'TrackGain';
    }

    /**
     * Get or set 'Next Video Info Overlay' state.
     * @param val - Flag to enable 'Next Video Info Overlay' or undefined.
     * @return 'Next Video Info Overlay' state.
     */
    enableNextVideoInfoOverlay(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableNextVideoInfoOverlay', val.toString());
            return toBoolean(this.get('enableNextVideoInfoOverlay', false), true);
        }

        return toBoolean(this.get('enableNextVideoInfoOverlay', false), true);
    }

    /**
     * Get or set 'Video Remaining/Total Time' state.
     * @param val - Flag to enable 'Video Remaining/Total Time' or undefined.
     * @return 'Video Remaining/Total Time' state.
     */
    enableVideoRemainingTime(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableVideoRemainingTime', val.toString());
            return toBoolean(this.get('enableVideoRemainingTime', false), true);
        }

        return toBoolean(this.get('enableVideoRemainingTime', false), true);
    }

    /**
     * Get or set 'Theme Songs' state.
     * @param val - Flag to enable 'Theme Songs' or undefined.
     * @return 'Theme Songs' state.
     */
    enableThemeSongs(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableThemeSongs', val.toString(), false);
            return toBoolean(this.get('enableThemeSongs', false), false);
        }

        return toBoolean(this.get('enableThemeSongs', false), false);
    }

    /**
     * Get or set 'Theme Videos' state.
     * @param val - Flag to enable 'Theme Videos' or undefined.
     * @return 'Theme Videos' state.
     */
    enableThemeVideos(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableThemeVideos', val.toString(), false);
            return toBoolean(this.get('enableThemeVideos', false), false);
        }

        return toBoolean(this.get('enableThemeVideos', false), false);
    }

    /**
     * Get or set 'Fast Fade-in' state.
     * @param val - Flag to enable 'Fast Fade-in' or undefined.
     * @return 'Fast Fade-in' state.
     */
    enableFastFadein(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('fastFadein', val.toString(), false);
            return toBoolean(this.get('fastFadein', false), true);
        }

        return toBoolean(this.get('fastFadein', false), true);
    }

    /**
     * Get or set 'Blurhash' state.
     * @param val - Flag to enable 'Blurhash' or undefined.
     * @return 'Blurhash' state.
     */
    enableBlurhash(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('blurhash', val.toString(), false);
            return toBoolean(this.get('blurhash', false), true);
        }

        return toBoolean(this.get('blurhash', false), true);
    }

    /**
     * Get or set 'Backdrops' state.
     * @param val - Flag to enable 'Backdrops' or undefined.
     * @return 'Backdrops' state.
     */
    enableBackdrops(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableBackdrops', val.toString(), false);
            return toBoolean(this.get('enableBackdrops', false), false);
        }

        return toBoolean(this.get('enableBackdrops', false), false);
    }

    /**
     * Get or set 'disableCustomCss' state.
     * @param val - Flag to enable 'disableCustomCss' or undefined.
     * @return 'disableCustomCss' state.
     */
    disableCustomCss(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('disableCustomCss', val.toString(), false);
            return toBoolean(this.get('disableCustomCss', false), false);
        }

        return toBoolean(this.get('disableCustomCss', false), false);
    }

    /**
     * Get or set customCss.
     * @param val - Language.
     * @return Language.
     */
    customCss(val?: string): string | null {
        if (val !== undefined) {
            this.set('customCss', val.toString(), false);
            return this.get('customCss', false);
        }

        return this.get('customCss', false);
    }

    /**
     * Get or set 'Details Banner' state.
     * @param val - Flag to enable 'Details Banner' or undefined.
     * @return 'Details Banner' state.
     */
    detailsBanner(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('detailsBanner', val.toString(), false);
            return toBoolean(this.get('detailsBanner', false), true);
        }

        return toBoolean(this.get('detailsBanner', false), true);
    }

    /**
     * Get or set 'Use Episode Images in Next Up and Continue Watching' state.
     * @param val - Flag to enable 'Use Episode Images in Next Up' or undefined.
     * @return 'Use Episode Images in Next Up' state.
     */
    useEpisodeImagesInNextUpAndResume(val?: string | boolean): boolean {
        if (val !== undefined) {
            this.set('useEpisodeImagesInNextUpAndResume', val.toString(), true);
            return toBoolean(this.get('useEpisodeImagesInNextUpAndResume', true), false);
        }

        return toBoolean(this.get('useEpisodeImagesInNextUpAndResume', true), false);
    }

    /**
     * Get or set language.
     * @param val - Language.
     * @return Language.
     */
    language(val?: string): string | null {
        if (val !== undefined) {
            this.set('language', val.toString(), false);
            return this.get('language', false);
        }

        return this.get('language', false);
    }

    /**
     * Get or set datetime locale.
     * @param val - Datetime locale.
     * @return Datetime locale.
     */
    dateTimeLocale(val?: string): string | null {
        if (val !== undefined) {
            this.set('datetimelocale', val.toString(), false);
            return this.get('datetimelocale', false);
        }

        return this.get('datetimelocale', false);
    }

    /**
     * Get or set amount of rewind.
     * @param val - Amount of rewind.
     * @return Amount of rewind.
     */
    skipBackLength(val?: number): number {
        if (val !== undefined) {
            this.set('skipBackLength', val.toString());
            return parseInt(this.get('skipBackLength') || '10000', 10);
        }

        return parseInt(this.get('skipBackLength') || '10000', 10);
    }

    /**
     * Get or set amount of fast forward.
     * @param val - Amount of fast forward.
     * @return Amount of fast forward.
     */
    skipForwardLength(val?: number): number {
        if (val !== undefined) {
            this.set('skipForwardLength', val.toString());
            return parseInt(this.get('skipForwardLength') || '30000', 10);
        }

        return parseInt(this.get('skipForwardLength') || '30000', 10);
    }

    /**
     * Get or set theme for Dashboard.
     * @param val - Theme for Dashboard.
     * @return Theme for Dashboard.
     */
    dashboardTheme(val?: string): string | null {
        if (val !== undefined) {
            this.set('dashboardTheme', val);
            return this.get('dashboardTheme');
        }

        return this.get('dashboardTheme');
    }

    /**
     * Get or set skin.
     * @param val - Skin.
     * @return Skin.
     */
    skin(val?: string): string | null {
        if (val !== undefined) {
            this.set('skin', val, false);
            return this.get('skin', false);
        }

        return this.get('skin', false);
    }

    /**
     * Get or set main theme.
     * @param val - Main theme.
     * @return Main theme.
     */
    theme(val?: string): string | null {
        if (val !== undefined) {
            this.set('appTheme', val, false);
            return this.get('appTheme', false);
        }

        return this.get('appTheme', false);
    }

    /**
     * Get or set screensaver.
     * @param val - Screensaver.
     * @return Screensaver.
     */
    screensaver(val?: string): string | null {
        if (val !== undefined) {
            this.set('screensaver', val, false);
            return this.get('screensaver', false);
        }

        return this.get('screensaver', false);
    }

    /**
     * Get or set the interval between backdrops when using the backdrop screensaver.
     * @param val - The interval between backdrops in seconds.
     * @return The interval between backdrops in seconds.
     */
    backdropScreensaverInterval(val?: number): number {
        if (val !== undefined) {
            this.set('backdropScreensaverInterval', val.toString(), false);
            return parseInt(this.get('backdropScreensaverInterval', false) as string, 10) || 5;
        }

        return parseInt(this.get('backdropScreensaverInterval', false) as string, 10) || 5;
    }

    /**
     * Get or set the interval between slides when using the slideshow.
     * @param val - The interval between slides in seconds.
     * @return The interval between slides in seconds.
     */
    slideshowInterval(val?: number): number {
        if (val !== undefined) {
            this.set('slideshowInterval', val.toString(), false);
            return parseInt(this.get('slideshowInterval', false) as string, 10) || 5;
        }

        return parseInt(this.get('slideshowInterval', false) as string, 10) || 5;
    }

    /**
     * Get or set the amount of time it takes to activate the screensaver in seconds. Default 3 minutes.
     * @param val - The amount of time it takes to activate the screensaver in seconds.
     * @return The amount of time it takes to activate the screensaver in seconds.
     */
    screensaverTime(val?: number): number {
        if (val !== undefined) {
            this.set('screensaverTime', val.toString(), false);
            return parseInt(this.get('screensaverTime', false) as string, 10) || 180;
        }

        return parseInt(this.get('screensaverTime', false) as string, 10) || 180;
    }

    /**
     * Get or set library page size.
     * @param val - Library page size.
     * @return Library page size.
     */
    libraryPageSize(val?: number): number {
        if (val !== undefined) {
            this.set('libraryPageSize', val.toString(), false);
            const libraryPageSize = parseInt(this.get('libraryPageSize', false) as string, 10);
            if (libraryPageSize === 0) {
                return 0;
            } else {
                return libraryPageSize || 100;
            }
        }

        const libraryPageSize = parseInt(this.get('libraryPageSize', false) as string, 10);
        if (libraryPageSize === 0) {
            // Explicitly return 0 to avoid returning 100 because 0 is falsy.
            return 0;
        } else {
            return libraryPageSize || 100;
        }
    }

    /**
     * Get or set max days for next up list.
     * @param val - Max days for next up.
     * @return Max days for a show to stay in next up without being watched.
     */
    maxDaysForNextUp(val?: number): number {
        if (val !== undefined) {
            this.set('maxDaysForNextUp', val.toString(), false);
            const maxDaysForNextUp = parseInt(this.get('maxDaysForNextUp', false) as string, 10);
            if (maxDaysForNextUp === 0) {
                return 0;
            } else {
                return maxDaysForNextUp || 365;
            }
        }

        const maxDaysForNextUp = parseInt(this.get('maxDaysForNextUp', false) as string, 10);
        if (maxDaysForNextUp === 0) {
            // Explicitly return 0 to avoid returning 100 because 0 is falsy.
            return 0;
        } else {
            return maxDaysForNextUp || 365;
        }
    }

    /**
     * Get or set rewatching in next up.
     * @param val - If rewatching items should be included in next up.
     * @returns Rewatching in next up state.
     */
    enableRewatchingInNextUp(val?: boolean): boolean {
        if (val !== undefined) {
            this.set('enableRewatchingInNextUp', val.toString(), false);
            return toBoolean(this.get('enableRewatchingInNextUp', false), false);
        }

        return toBoolean(this.get('enableRewatchingInNextUp', false), false);
    }

    /**
     * Get or set sound effects.
     * @param val - Sound effects.
     * @return Sound effects.
     */
    soundEffects(val?: string): string | null {
        if (val !== undefined) {
            this.set('soundeffects', val, false);
            return this.get('soundeffects', false);
        }

        return this.get('soundeffects', false);
    }

    /**
     * Load query settings.
     * @param key - Query key.
     * @param query - Query base.
     * @return Query.
     */
    loadQuerySettings(key: string, query: Record<string, unknown>): Record<string, unknown> {
        let sortSettings: Record<string, unknown> | undefined;
        let filterSettings: Record<string, unknown> | undefined;
        let sortSettingsStr = this.get(key);
        let filterSettingsStr = this.get(key + filterSettingsPostfix, false);

        if (sortSettingsStr) {
            sortSettings = filterQuerySettings(JSON.parse(sortSettingsStr), allowedSortSettings);
        }
        if (filterSettingsStr) {
            filterSettings = filterQuerySettings(JSON.parse(filterSettingsStr), allowedFilterSettings);
        }

        return Object.assign(query, sortSettings, filterSettings);
    }

    /**
     * Save query settings.
     * @param key - Query key.
     * @param query - Query.
     */
    saveQuerySettings(key: string, query: Record<string, unknown>): void {
        const sortSettings = filterQuerySettings(query, allowedSortSettings);
        const filterSettings = filterQuerySettings(query, allowedFilterSettings);

        this.set(key, JSON.stringify(sortSettings));
        this.set(key + filterSettingsPostfix, JSON.stringify(filterSettings), false);
    }

    /**
     * Get view layout setting.
     * @param key - View Setting key.
     * @return View Setting value.
     */
    getSavedView(key: string): string | null {
        return this.get(key + '-_view');
    }

    /**
     * Set view layout setting.
     * @param key - View Setting key.
     * @param value - View Setting value.
     */
    saveViewSetting(key: string, value: string): void {
        this.set(key + '-_view', value);
    }

    /**
     * Get subtitle appearance settings.
     * @param key - Settings key.
     * @return Subtitle appearance settings.
     */
    getSubtitleAppearanceSettings(key?: string): Record<string, unknown> {
        const settingsKey = key || 'localplayersubtitleappearance3';
        return Object.assign(defaultSubtitleAppearanceSettings, JSON.parse(this.get(settingsKey, false) || '{}'));
    }

    /**
     * Set subtitle appearance settings.
     * @param value - Subtitle appearance settings.
     * @param key - Settings key.
     */
    setSubtitleAppearanceSettings(value: Record<string, unknown>, key?: string): void {
        const settingsKey = key || 'localplayersubtitleappearance3';
        this.set(settingsKey, JSON.stringify(value), false);
    }

    /**
     * Get comics player settings.
     * @param mediaSourceId - Media Source Id.
     * @return Comics player settings.
     */
    getComicsPlayerSettings(mediaSourceId: string): Record<string, unknown> {
        const settings = JSON.parse(this.get('comicsPlayerSettings', false) || '{}');
        return Object.assign(defaultComicsPlayerSettings, settings[mediaSourceId]);
    }

    /**
     * Set comics player settings.
     * @param value - Comics player settings.
     * @param mediaSourceId - Media Source Id.
     */
    setComicsPlayerSettings(value: Record<string, unknown>, mediaSourceId: string): void {
        const settings = JSON.parse(this.get('comicsPlayerSettings', false) || '{}');
        settings[mediaSourceId] = value;
        this.set('comicsPlayerSettings', JSON.stringify(settings), false);
    }

    /**
     * Set filter.
     * @param key - Filter key.
     * @param value - Filter value.
     */
    setFilter(key: string, value: string): void {
        this.set(key, value, true);
    }

    /**
     * Get filter.
     * @param key - Filter key.
     * @return Filter value.
     */
    getFilter(key: string): string | null {
        return this.get(key, true);
    }

    /**
     * Gets the current sort values (Legacy - Non-JSON)
     * (old views such as list.js [Photos] will
     * use this one)
     * @param key - Filter key.
     * @param defaultSortBy - Default SortBy value.
     * @return sortOptions object
     */
    getSortValuesLegacy(key: string, defaultSortBy: string): { sortBy: string | null; sortOrder: string } {
        return {
            sortBy: this.getFilter(key + '-sortby') || defaultSortBy,
            sortOrder: this.getFilter(key + '-sortorder') === 'Descending' ? 'Descending' : 'Ascending'
        };
    }
}

export const currentSettings = new UserSettings;

// Wrappers for non-ES6 modules and backward compatibility
export const setUserInfo = currentSettings.setUserInfo.bind(currentSettings);
export const set = currentSettings.set.bind(currentSettings);
export const get = currentSettings.get.bind(currentSettings);
export const serverConfig = currentSettings.serverConfig.bind(currentSettings);
export const allowedAudioChannels = currentSettings.allowedAudioChannels.bind(currentSettings);
export const preferFmp4HlsContainer = currentSettings.preferFmp4HlsContainer.bind(currentSettings);
export const limitSegmentLength = currentSettings.limitSegmentLength.bind(currentSettings);
export const enableCinemaMode = currentSettings.enableCinemaMode.bind(currentSettings);
export const selectAudioNormalization = currentSettings.selectAudioNormalization.bind(currentSettings);
export const enableNextVideoInfoOverlay = currentSettings.enableNextVideoInfoOverlay.bind(currentSettings);
export const enableVideoRemainingTime = currentSettings.enableVideoRemainingTime.bind(currentSettings);
export const enableThemeSongs = currentSettings.enableThemeSongs.bind(currentSettings);
export const enableThemeVideos = currentSettings.enableThemeVideos.bind(currentSettings);
export const enableFastFadein = currentSettings.enableFastFadein.bind(currentSettings);
export const enableBlurhash = currentSettings.enableBlurhash.bind(currentSettings);
export const enableBackdrops = currentSettings.enableBackdrops.bind(currentSettings);
export const detailsBanner = currentSettings.detailsBanner.bind(currentSettings);
export const useEpisodeImagesInNextUpAndResume = currentSettings.useEpisodeImagesInNextUpAndResume.bind(currentSettings);
export const language = currentSettings.language.bind(currentSettings);
export const dateTimeLocale = currentSettings.dateTimeLocale.bind(currentSettings);
export const skipBackLength = currentSettings.skipBackLength.bind(currentSettings);
export const skipForwardLength = currentSettings.skipForwardLength.bind(currentSettings);
export const dashboardTheme = currentSettings.dashboardTheme.bind(currentSettings);
export const skin = currentSettings.skin.bind(currentSettings);
export const theme = currentSettings.theme.bind(currentSettings);
export const screensaver = currentSettings.screensaver.bind(currentSettings);
export const backdropScreensaverInterval = currentSettings.backdropScreensaverInterval.bind(currentSettings);
export const slideshowInterval = currentSettings.slideshowInterval.bind(currentSettings);
export const screensaverTime = currentSettings.screensaverTime.bind(currentSettings);
export const libraryPageSize = currentSettings.libraryPageSize.bind(currentSettings);
export const maxDaysForNextUp = currentSettings.maxDaysForNextUp.bind(currentSettings);
export const enableRewatchingInNextUp = currentSettings.enableRewatchingInNextUp.bind(currentSettings);
export const soundEffects = currentSettings.soundEffects.bind(currentSettings);
export const loadQuerySettings = currentSettings.loadQuerySettings.bind(currentSettings);
export const saveQuerySettings = currentSettings.saveQuerySettings.bind(currentSettings);
export const getSubtitleAppearanceSettings = currentSettings.getSubtitleAppearanceSettings.bind(currentSettings);
export const setSubtitleAppearanceSettings = currentSettings.setSubtitleAppearanceSettings.bind(currentSettings);
export const getComicsPlayerSettings = currentSettings.getComicsPlayerSettings.bind(currentSettings);
export const setComicsPlayerSettings = currentSettings.setComicsPlayerSettings.bind(currentSettings);
export const setFilter = currentSettings.setFilter.bind(currentSettings);
export const getFilter = currentSettings.getFilter.bind(currentSettings);
export const customCss = currentSettings.customCss.bind(currentSettings);
export const disableCustomCss = currentSettings.disableCustomCss.bind(currentSettings);
export const getSavedView = currentSettings.getSavedView.bind(currentSettings);
export const saveViewSetting = currentSettings.saveViewSetting.bind(currentSettings);
export const getSortValuesLegacy = currentSettings.getSortValuesLegacy.bind(currentSettings);
