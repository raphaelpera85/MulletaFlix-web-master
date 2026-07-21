import escapeHtml from 'escape-html';

import { AppFeature } from 'constants/appFeature';
import { getUserQuery } from 'hooks/api/useUser';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { queryClient } from 'utils/query/queryClient';

import browser from '../../scripts/browser';
import layoutManager from '../layoutManager';
import { pluginManager } from '../pluginManager';
import { appHost } from '../apphost';
import focusManager from '../focusManager';
import datetime from '../../scripts/datetime';
import globalize from '../../lib/globalize';
import loading from '../loading/loading';
import skinManager from '../../scripts/themeManager';
import { PluginType } from '../../types/plugin';
import Events from '../../utils/events';
import toast from '../toast/toast';

import template from './displaySettings.template.html';

import '../../elements/emby-select/emby-select';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-textarea/emby-textarea';

function fillThemes(select: HTMLSelectElement, selectedTheme?: string): void {
    skinManager.getThemes().then((themes: any[]) => {
        select.innerHTML = themes.map(t => {
            return `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
        }).join('');

        // get default theme
        const defaultTheme = themes.find(theme => theme.default);

        // set the current theme
        select.value = selectedTheme || defaultTheme.id;
    });
}

function loadScreensavers(context: HTMLElement, userSettings: any): void {
    const selectScreensaver = context.querySelector('.selectScreensaver') as HTMLSelectElement;
    const options = pluginManager.ofType(PluginType.Screensaver).map(plugin => {
        return {
            name: globalize.translate(plugin.name),
            value: plugin.id
        };
    });

    options.unshift({
        name: globalize.translate('None'),
        value: 'none'
    });

    selectScreensaver.innerHTML = options.map(o => {
        return `<option value="${o.value}">${escapeHtml(o.name)}</option>`;
    }).join('');

    selectScreensaver.value = userSettings.screensaver();

    if (!selectScreensaver.value) {
        // TODO: set the default instead of none
        selectScreensaver.value = 'none';
    }
}

function showOrHideMissingEpisodesField(context: HTMLElement): void {
    if (browser.tizen || browser.web0s) {
        context.querySelector('.fldDisplayMissingEpisodes')!.classList.add('hide');
        return;
    }

    context.querySelector('.fldDisplayMissingEpisodes')!.classList.remove('hide');
}

function loadForm(context: HTMLElement, user: any, userSettings: any): void {
    if (appHost.supports(AppFeature.DisplayLanguage)) {
        context.querySelector('.languageSection')!.classList.remove('hide');
    } else {
        context.querySelector('.languageSection')!.classList.add('hide');
    }

    if (appHost.supports(AppFeature.DisplayMode)) {
        context.querySelector('.fldDisplayMode')!.classList.remove('hide');
    } else {
        context.querySelector('.fldDisplayMode')!.classList.add('hide');
    }

    if (appHost.supports(AppFeature.ExternalLinks)) {
        context.querySelector('.learnHowToContributeContainer')!.classList.remove('hide');
    } else {
        context.querySelector('.learnHowToContributeContainer')!.classList.add('hide');
    }

    context.querySelector('.selectDashboardThemeContainer')!.classList.toggle('hide', !user.Policy.IsAdministrator);
    context.querySelector('.txtSlideshowIntervalContainer')!.classList.remove('hide');

    if (appHost.supports(AppFeature.Screensaver)) {
        context.querySelector('.selectScreensaverContainer')!.classList.remove('hide');
        context.querySelector('.txtBackdropScreensaverIntervalContainer')!.classList.remove('hide');
        context.querySelector('.txtScreensaverTimeContainer')!.classList.remove('hide');
    } else {
        context.querySelector('.selectScreensaverContainer')!.classList.add('hide');
        context.querySelector('.txtBackdropScreensaverIntervalContainer')!.classList.add('hide');
        context.querySelector('.txtScreensaverTimeContainer')!.classList.add('hide');
    }

    if (datetime.supportsLocalization()) {
        context.querySelector('.fldDateTimeLocale')!.classList.remove('hide');
    } else {
        context.querySelector('.fldDateTimeLocale')!.classList.add('hide');
    }

    fillThemes(context.querySelector('#selectTheme') as HTMLSelectElement, userSettings.theme());
    fillThemes(context.querySelector('#selectDashboardTheme') as HTMLSelectElement, userSettings.dashboardTheme());

    loadScreensavers(context, userSettings);

    (context.querySelector('#txtBackdropScreensaverInterval') as HTMLInputElement).value = userSettings.backdropScreensaverInterval();
    (context.querySelector('#txtSlideshowInterval') as HTMLInputElement).value = userSettings.slideshowInterval();
    (context.querySelector('#txtScreensaverTime') as HTMLInputElement).value = userSettings.screensaverTime();

    (context.querySelector('.chkDisplayMissingEpisodes') as HTMLInputElement).checked = user.Configuration.DisplayMissingEpisodes || false;

    (context.querySelector('#chkThemeSong') as HTMLInputElement).checked = userSettings.enableThemeSongs();
    (context.querySelector('#chkThemeVideo') as HTMLInputElement).checked = userSettings.enableThemeVideos();
    (context.querySelector('#chkFadein') as HTMLInputElement).checked = userSettings.enableFastFadein();
    (context.querySelector('#chkBlurhash') as HTMLInputElement).checked = userSettings.enableBlurhash();
    (context.querySelector('#chkBackdrops') as HTMLInputElement).checked = userSettings.enableBackdrops();
    (context.querySelector('#chkDetailsBanner') as HTMLInputElement).checked = userSettings.detailsBanner();

    (context.querySelector('#chkDisableCustomCss') as HTMLInputElement).checked = userSettings.disableCustomCss();
    (context.querySelector('#txtLocalCustomCss') as HTMLTextAreaElement).value = userSettings.customCss();

    (context.querySelector('#selectLanguage') as HTMLSelectElement).value = userSettings.language() || '';
    (context.querySelector('.selectDateTimeLocale') as HTMLSelectElement).value = userSettings.dateTimeLocale() || '';

    (context.querySelector('#txtLibraryPageSize') as HTMLInputElement).value = userSettings.libraryPageSize();

    (context.querySelector('#txtMaxDaysForNextUp') as HTMLInputElement).value = userSettings.maxDaysForNextUp();
    (context.querySelector('#chkRewatchingNextUp') as HTMLInputElement).checked = userSettings.enableRewatchingInNextUp();
    (context.querySelector('#chkUseEpisodeImagesInNextUp') as HTMLInputElement).checked = userSettings.useEpisodeImagesInNextUpAndResume();

    (context.querySelector('.selectLayout') as HTMLSelectElement).value = layoutManager.getSavedLayout() || '';

    showOrHideMissingEpisodesField(context);

    loading.hide();
}

function saveUser(context: HTMLElement, user: any, userSettingsInstance: any, apiClient: any): Promise<void> {
    user.Configuration.DisplayMissingEpisodes = (context.querySelector('.chkDisplayMissingEpisodes') as HTMLInputElement).checked;

    if (appHost.supports(AppFeature.DisplayLanguage)) {
        userSettingsInstance.language((context.querySelector('#selectLanguage') as HTMLSelectElement).value);
    }

    userSettingsInstance.dateTimeLocale((context.querySelector('.selectDateTimeLocale') as HTMLSelectElement).value);

    userSettingsInstance.enableThemeSongs((context.querySelector('#chkThemeSong') as HTMLInputElement).checked);
    userSettingsInstance.enableThemeVideos((context.querySelector('#chkThemeVideo') as HTMLInputElement).checked);
    userSettingsInstance.theme((context.querySelector('#selectTheme') as HTMLSelectElement).value);
    userSettingsInstance.dashboardTheme((context.querySelector('#selectDashboardTheme') as HTMLSelectElement).value);
    userSettingsInstance.screensaver((context.querySelector('.selectScreensaver') as HTMLSelectElement).value);
    userSettingsInstance.backdropScreensaverInterval((context.querySelector('#txtBackdropScreensaverInterval') as HTMLInputElement).value);
    userSettingsInstance.slideshowInterval((context.querySelector('#txtSlideshowInterval') as HTMLInputElement).value);
    userSettingsInstance.screensaverTime((context.querySelector('#txtScreensaverTime') as HTMLInputElement).value);

    userSettingsInstance.libraryPageSize((context.querySelector('#txtLibraryPageSize') as HTMLInputElement).value);

    userSettingsInstance.maxDaysForNextUp((context.querySelector('#txtMaxDaysForNextUp') as HTMLInputElement).value);
    userSettingsInstance.enableRewatchingInNextUp((context.querySelector('#chkRewatchingNextUp') as HTMLInputElement).checked);
    userSettingsInstance.useEpisodeImagesInNextUpAndResume((context.querySelector('#chkUseEpisodeImagesInNextUp') as HTMLInputElement).checked);

    userSettingsInstance.enableFastFadein((context.querySelector('#chkFadein') as HTMLInputElement).checked);
    userSettingsInstance.enableBlurhash((context.querySelector('#chkBlurhash') as HTMLInputElement).checked);
    userSettingsInstance.enableBackdrops((context.querySelector('#chkBackdrops') as HTMLInputElement).checked);
    userSettingsInstance.detailsBanner((context.querySelector('#chkDetailsBanner') as HTMLInputElement).checked);

    userSettingsInstance.disableCustomCss((context.querySelector('#chkDisableCustomCss') as HTMLInputElement).checked);
    userSettingsInstance.customCss((context.querySelector('#txtLocalCustomCss') as HTMLTextAreaElement).value);

    if (user.Id === apiClient.getCurrentUserId()) {
        skinManager.setTheme(userSettingsInstance.theme());
    }

    layoutManager.setLayout((context.querySelector('.selectLayout') as HTMLSelectElement).value);
    return apiClient.updateUserConfiguration(user.Id, user.Configuration);
}

function save(instance: DisplaySettings, context: HTMLElement, userId: string, userSettings: any, apiClient: any, enableSaveConfirmation: boolean): void {
    loading.show();

    apiClient.getUser(userId).then((user: any) => {
        saveUser(context, user, userSettings, apiClient).then(() => {
            loading.hide();
            if (enableSaveConfirmation) {
                toast(globalize.translate('SettingsSaved'));
            }
            Events.trigger(instance, 'saved');
        }, () => {
            loading.hide();
        });
    });
}

function onSubmit(this: any, e: Event): void {
    const self = this;
    const apiClient = ServerConnections.getApiClient(self.options.serverId);
    const userId = self.options.userId;
    const userSettings = self.options.userSettings;

    userSettings.setUserInfo(userId, apiClient).then(() => {
        const enableSaveConfirmation = self.options.enableSaveConfirmation;
        save(self, self.options.element, userId, userSettings, apiClient, enableSaveConfirmation);
    });

    // Disable default form submission
    if (e) {
        e.preventDefault();
    }
}

function embed(options: any, self: DisplaySettings): void {
    options.element.innerHTML = globalize.translateHtml(template, 'core');
    options.element.querySelector('form').addEventListener('submit', onSubmit.bind(self));
    if (options.enableSaveButton) {
        options.element.querySelector('.btnSave').classList.remove('hide');
    }
    self.loadData(options.autoFocus);
}

class DisplaySettings {
    options: any;
    dataLoaded: boolean = false;

    constructor(options: any) {
        this.options = options;
        embed(options, this);
    }

    async loadData(autoFocus?: boolean): Promise<void> {
        const self = this;
        const context = self.options.element;

        loading.show();

        const userId = self.options.userId;
        const apiClient: any = ServerConnections.getApiClient(self.options.serverId);
        const userSettings = self.options.userSettings;

        let user: any;
        try {
            user = await queryClient.fetchQuery(getUserQuery(toApi(apiClient), { userId }));
        } catch (error) {
            console.warn('Error fetching user with React Query, falling back to direct API call:', error);
            user = await apiClient.getUser(userId);
        }
        await userSettings.setUserInfo(userId, apiClient);

        self.dataLoaded = true;
        loadForm(context, user, userSettings);
        if (autoFocus) {
            focusManager.autoFocus(context);
        }
    }

    submit(): void {
        onSubmit.call(this, new Event('submit'));
    }

    destroy(): void {
        this.options = null;
    }
}

export default DisplaySettings;
