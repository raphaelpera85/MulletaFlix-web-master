import { AppFeature } from 'constants/appFeature';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { appHost } from '../apphost';
import appSettings from '../../scripts/settings/appSettings';
import focusManager from '../focusManager';
import layoutManager from '../layoutManager';
import loading from '../loading/loading';
import subtitleAppearanceHelper from './subtitleappearancehelper';
import settingsHelper from '../settingshelper';
import dom from '../../utils/dom';
import Events from '../../utils/events';

import '../listview/listview.scss';
import '../../elements/emby-select/emby-select';
import '../../elements/emby-slider/emby-slider';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../styles/flexstyles.scss';
import './subtitlesettings.scss';
import toast from '../toast/toast';
import template from './subtitlesettings.template.html';

interface SubtitleAppearanceObject {
    subtitleStyling: string;
    textSize: string;
    textWeight: string;
    dropShadow: string;
    font: string;
    textBackground: string;
    textColor: string;
    verticalPosition: string;
}

interface SubtitleSettingsOptions {
    element: HTMLElement;
    userId?: string;
    serverId?: string;
    userSettings?: any;
    appearanceKey?: string;
    enableSaveButton?: boolean;
    enableSaveConfirmation?: boolean;
    autoFocus?: boolean;
}

function getSubtitleAppearanceObject(context: Element): SubtitleAppearanceObject {
    return {
        subtitleStyling: (context.querySelector('#selectSubtitleStyling') as HTMLSelectElement).value,
        textSize: (context.querySelector('#selectTextSize') as HTMLSelectElement).value,
        textWeight: (context.querySelector('#selectTextWeight') as HTMLSelectElement).value,
        dropShadow: (context.querySelector('#selectDropShadow') as HTMLSelectElement).value,
        font: (context.querySelector('#selectFont') as HTMLSelectElement).value,
        textBackground: (context.querySelector('#inputTextBackground') as HTMLInputElement).value,
        textColor: layoutManager.tv ? (context.querySelector('#selectTextColor') as HTMLSelectElement).value : (context.querySelector('#inputTextColor') as HTMLInputElement).value,
        verticalPosition: (context.querySelector('#sliderVerticalPosition') as HTMLInputElement).value
    };
}

function loadForm(context: Element, user: any, userSettings: any, appearanceSettings: any, apiClient: any): void {
    apiClient.getCultures().then(function (allCultures: any[]) {
        if (appHost.supports(AppFeature.SubtitleBurnIn) && user.Policy.EnableVideoPlaybackTranscoding) {
            context.querySelector('.fldBurnIn')!.classList.remove('hide');
        }

        const selectSubtitleLanguage = context.querySelector('#selectSubtitleLanguage') as HTMLSelectElement;

        settingsHelper.populateLanguages(selectSubtitleLanguage, allCultures);

        selectSubtitleLanguage.value = user.Configuration.SubtitleLanguagePreference || '';
        (context.querySelector('#selectSubtitlePlaybackMode') as HTMLSelectElement).value = user.Configuration.SubtitleMode || '';

        context.querySelector('#selectSubtitlePlaybackMode')!.dispatchEvent(new CustomEvent('change', {}));

        (context.querySelector('#selectSubtitleStyling') as HTMLSelectElement).value = appearanceSettings.subtitleStyling || 'Auto';
        context.querySelector('#selectSubtitleStyling')!.dispatchEvent(new CustomEvent('change', {}));
        (context.querySelector('#selectTextSize') as HTMLSelectElement).value = appearanceSettings.textSize || '';
        (context.querySelector('#selectTextWeight') as HTMLSelectElement).value = appearanceSettings.textWeight || 'normal';
        (context.querySelector('#selectDropShadow') as HTMLSelectElement).value = appearanceSettings.dropShadow || '';
        (context.querySelector('#inputTextBackground') as HTMLInputElement).value = appearanceSettings.textBackground || 'transparent';
        (context.querySelector('#selectTextColor') as HTMLSelectElement).value = appearanceSettings.textColor || '#ffffff';
        (context.querySelector('#inputTextColor') as HTMLInputElement).value = appearanceSettings.textColor || '#ffffff';
        (context.querySelector('#selectFont') as HTMLSelectElement).value = appearanceSettings.font || '';
        (context.querySelector('#sliderVerticalPosition') as HTMLInputElement).value = appearanceSettings.verticalPosition;

        (context.querySelector('#selectSubtitleBurnIn') as HTMLSelectElement).value = appSettings.get('subtitleburnin') || '';
        (context.querySelector('#chkSubtitleRenderPgs') as HTMLInputElement).checked = appSettings.get('subtitlerenderpgs') === 'true';

        context.querySelector('#selectSubtitleBurnIn')!.dispatchEvent(new CustomEvent('change', {}));
        (context.querySelector('#chkAlwaysBurnInSubtitleWhenTranscoding') as HTMLInputElement).checked = appSettings.alwaysBurnInSubtitleWhenTranscoding();

        onAppearanceFieldChange({
            target: context.querySelector('#selectTextSize')
        } as Event);

        loading.hide();
    });
}

function saveUser(context: Element, user: any, userSettings: any, appearanceKey: string | undefined, apiClient: any): Promise<any> {
    let appearanceSettings = userSettings.getSubtitleAppearanceSettings(appearanceKey);
    appearanceSettings = Object.assign(appearanceSettings, getSubtitleAppearanceObject(context));

    userSettings.setSubtitleAppearanceSettings(appearanceSettings, appearanceKey);

    user.Configuration.SubtitleLanguagePreference = (context.querySelector('#selectSubtitleLanguage') as HTMLSelectElement).value;
    user.Configuration.SubtitleMode = (context.querySelector('#selectSubtitlePlaybackMode') as HTMLSelectElement).value;

    return apiClient.updateUserConfiguration(user.Id, user.Configuration);
}

function save(instance: SubtitleSettings, context: Element, userId: string | undefined, userSettings: any, apiClient: any, enableSaveConfirmation: boolean | undefined): void {
    loading.show();

    appSettings.set('subtitleburnin', (context.querySelector('#selectSubtitleBurnIn') as HTMLSelectElement).value);
    appSettings.set('subtitlerenderpgs', String((context.querySelector('#chkSubtitleRenderPgs') as HTMLInputElement).checked));
    appSettings.alwaysBurnInSubtitleWhenTranscoding((context.querySelector('#chkAlwaysBurnInSubtitleWhenTranscoding') as HTMLInputElement).checked);

    apiClient.getUser(userId).then(function (user: any) {
        saveUser(context, user, userSettings, instance.appearanceKey, apiClient).then(function () {
            loading.hide();
            if (enableSaveConfirmation) {
                toast(globalize.translate('SettingsSaved'));
            }

            Events.trigger(instance, 'saved');
        }, function () {
            loading.hide();
        });
    });
}

function onSubtitleModeChange(this: any, e: Event): void {
    const view = dom.parentWithClass(e.target as HTMLElement, 'subtitlesettings');
    if (!view) {
        return;
    }

    const subtitlesHelp = view.querySelectorAll('.subtitlesHelp');
    for (let i = 0, length = subtitlesHelp.length; i < length; i++) {
        subtitlesHelp[i].classList.add('hide');
    }
    view.querySelector('.subtitles' + this.value + 'Help')!.classList.remove('hide');
}

function onSubtitleStyleChange(this: any, e: Event): void {
    const view = dom.parentWithClass(e.target as HTMLElement, 'subtitlesettings');
    if (!view) {
        return;
    }

    const subtitleStylingHelperElements = view.querySelectorAll('.subtitleStylingHelp');
    subtitleStylingHelperElements.forEach((elem) => {
        elem.classList.add('hide');
    });
    view.querySelector(`.subtitleStyling${this.value}Help`)!.classList.remove('hide');
}

function onSubtitleBurnInChange(this: any, e: Event): void {
    const view = dom.parentWithClass(e.target as HTMLElement, 'subtitlesettings');
    if (!view) {
        return;
    }
    const fieldRenderPgs = view.querySelector('.fldRenderPgs')!;

    // Pgs option is only available if burn-in mode is set to 'auto' (empty string)
    fieldRenderPgs.classList.toggle('hide', !!this.value);
}

function onAppearanceFieldChange(e: Event): void {
    const view = dom.parentWithClass((e.target as HTMLElement), 'subtitlesettings');
    if (!view) {
        return;
    }

    const appearanceSettings = getSubtitleAppearanceObject(view);

    const elements = {
        window: view.querySelector('.subtitleappearance-preview-window'),
        text: view.querySelector('.subtitleappearance-preview-text'),
        preview: true
    };

    subtitleAppearanceHelper.applyStyles(elements as any, appearanceSettings);

    subtitleAppearanceHelper.applyStyles({
        window: view.querySelector('.subtitleappearance-fullpreview-window'),
        text: view.querySelector('.subtitleappearance-fullpreview-text')
    } as any, appearanceSettings);
}

const subtitlePreviewDelay = 1000;
let subtitlePreviewTimer: ReturnType<typeof setTimeout>;

function showSubtitlePreview(this: SubtitleSettings, persistent?: boolean): void {
    clearTimeout(subtitlePreviewTimer);

    this._fullPreview!.classList.remove('subtitleappearance-fullpreview-hide');

    if (persistent) {
        this._refFullPreview++;
    }

    if (this._refFullPreview === 0) {
        subtitlePreviewTimer = setTimeout(hideSubtitlePreview.bind(this), subtitlePreviewDelay);
    }
}

function hideSubtitlePreview(this: SubtitleSettings, persistent?: boolean): void {
    clearTimeout(subtitlePreviewTimer);

    if (persistent) {
        this._refFullPreview--;
    }

    if (this._refFullPreview === 0) {
        this._fullPreview!.classList.add('subtitleappearance-fullpreview-hide');
    }
}

function embed(options: SubtitleSettingsOptions, self: SubtitleSettings): void {
    options.element.classList.add('subtitlesettings');
    options.element.innerHTML = globalize.translateHtml(template, 'core');

    options.element.querySelector('form')!.addEventListener('submit', self.onSubmit.bind(self));

    options.element.querySelector('#selectSubtitlePlaybackMode')!.addEventListener('change', onSubtitleModeChange as EventListener);
    options.element.querySelector('#selectSubtitleStyling')!.addEventListener('change', onSubtitleStyleChange as EventListener);
    options.element.querySelector('#selectSubtitleBurnIn')!.addEventListener('change', onSubtitleBurnInChange as EventListener);
    options.element.querySelector('#selectTextSize')!.addEventListener('change', onAppearanceFieldChange);
    options.element.querySelector('#selectTextWeight')!.addEventListener('change', onAppearanceFieldChange);
    options.element.querySelector('#selectDropShadow')!.addEventListener('change', onAppearanceFieldChange);
    options.element.querySelector('#selectFont')!.addEventListener('change', onAppearanceFieldChange);
    options.element.querySelector('#selectTextColor')!.addEventListener('change', onAppearanceFieldChange);
    options.element.querySelector('#inputTextColor')!.addEventListener('change', onAppearanceFieldChange);
    options.element.querySelector('#inputTextBackground')!.addEventListener('change', onAppearanceFieldChange);

    if (options.enableSaveButton) {
        options.element.querySelector('.btnSave')!.classList.remove('hide');
    }

    if (appHost.supports(AppFeature.SubtitleAppearance)) {
        options.element.querySelector('.subtitleAppearanceSection')!.classList.remove('hide');

        self._fullPreview = options.element.querySelector('.subtitleappearance-fullpreview') as HTMLElement;
        self._refFullPreview = 0;

        const sliderVerticalPosition = options.element.querySelector('#sliderVerticalPosition') as HTMLInputElement;
        sliderVerticalPosition.addEventListener('input', onAppearanceFieldChange);
        sliderVerticalPosition.addEventListener('input', () => showSubtitlePreview.call(self));

        const eventPrefix = window.PointerEvent ? 'pointer' : 'mouse';
        sliderVerticalPosition.addEventListener(`${eventPrefix}enter`, () => showSubtitlePreview.call(self, true));
        sliderVerticalPosition.addEventListener(`${eventPrefix}leave`, () => hideSubtitlePreview.call(self, true));

        if (layoutManager.tv) {
            sliderVerticalPosition.addEventListener('focus', () => showSubtitlePreview.call(self, true));
            sliderVerticalPosition.addEventListener('blur', () => hideSubtitlePreview.call(self, true));

            // Give CustomElements time to attach
            setTimeout(() => {
                sliderVerticalPosition.classList.add('focusable');
                (sliderVerticalPosition as any).enableKeyboardDragging();
            }, 0);

            // Replace color picker
            dom.parentWithTag(options.element.querySelector('#inputTextColor')!, 'DIV')!.classList.add('hide');
            dom.parentWithTag(options.element.querySelector('#selectTextColor')!, 'DIV')!.classList.remove('hide');
        }

        options.element.querySelector('.chkPreview')!.addEventListener('change', (e: Event) => {
            if ((e.target as HTMLInputElement).checked) {
                showSubtitlePreview.call(self, true);
            } else {
                hideSubtitlePreview.call(self, true);
            }
        });
    }

    self.loadData();

    if (options.autoFocus) {
        focusManager.autoFocus(options.element);
    }
}

export class SubtitleSettings {
    options: SubtitleSettingsOptions | null;
    dataLoaded?: boolean;
    _fullPreview?: HTMLElement;
    _refFullPreview: number = 0;
    appearanceKey?: string;

    constructor(options: SubtitleSettingsOptions) {
        this.options = options;

        embed(options, this);
    }

    loadData(): void {
        const self = this;
        const context = self.options!.element;

        loading.show();

        const userId = self.options!.userId;
        const apiClient = ServerConnections.getApiClient(self.options!.serverId!) as any;
        const userSettings = self.options!.userSettings;

        apiClient.getUser(userId).then(function (user: any) {
            userSettings.setUserInfo(userId, apiClient).then(function () {
                self.dataLoaded = true;

                const appearanceSettings = userSettings.getSubtitleAppearanceSettings(self.options!.appearanceKey);

                loadForm(context, user, userSettings, appearanceSettings, apiClient);
            });
        });
    }

    submit(): void {
        this.onSubmit(null);
    }

    destroy(): void {
        this.options = null;
    }

    onSubmit(e: Event | null): false {
        const self = this;
        const apiClient = ServerConnections.getApiClient(self.options!.serverId!) as any;
        const userId = self.options!.userId;
        const userSettings = self.options!.userSettings;

        userSettings.setUserInfo(userId, apiClient).then(function () {
            const enableSaveConfirmation = self.options!.enableSaveConfirmation;
            save(self, self.options!.element, userId, userSettings, apiClient, enableSaveConfirmation);
        });

        // Disable default form submission
        if (e) {
            e.preventDefault();
        }
        return false;
    }
}

export default SubtitleSettings;
