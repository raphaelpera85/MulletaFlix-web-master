
/**
 * Module for library options editor.
 * @module components/libraryoptionseditor/libraryoptionseditor
 */

import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import type { CountryInfo } from '@jellyfin/sdk/lib/generated-client/models/country-info';
import type { CultureDto } from '@jellyfin/sdk/lib/generated-client/models/culture-dto';
import type { LibraryOptionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/library-option-info-dto';
import type { LibraryOptions } from '@jellyfin/sdk/lib/generated-client/models/library-options';
import type { ServerConfiguration } from '@jellyfin/sdk/lib/generated-client/models/server-configuration';
import type { TypeOptions } from '@jellyfin/sdk/lib/generated-client/models/type-options';
import escapeHtml from 'escape-html';

import globalize from '../../lib/globalize';

// Extended TypeOptions to include editor-specific properties
interface EditorTypeOptions extends TypeOptions {
    SimilarItemProviders?: string[];
    SimilarItemProviderOrder?: string[];
}

// Extended LibraryOptions to include editor-specific properties
interface EditorLibraryOptions extends LibraryOptions {
    EnableArchiveMediaFiles?: boolean;
    TypeOptions?: EditorTypeOptions[];
}

// Available library options returned by the API
interface AvailableTypeOption {
    Type?: string | null;
    MetadataFetchers?: LibraryOptionInfoDto[];
    ImageFetchers?: LibraryOptionInfoDto[];
    SimilarItemProviders?: LibraryOptionInfoDto[];
    SupportedImageTypes?: string[];
}

interface AvailableLibraryOptions {
    TypeOptions?: AvailableTypeOption[];
    MetadataSavers?: LibraryOptionInfoDto[];
    MetadataReaders?: LibraryOptionInfoDto[];
    SubtitleFetchers?: LibraryOptionInfoDto[];
    LyricFetchers?: LibraryOptionInfoDto[];
    MediaSegmentProviders?: LibraryOptionInfoDto[];
}
import dom from '../../utils/dom';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-select/emby-select';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-textarea/emby-textarea';
import './style.scss';
import template from './libraryoptionseditor.template.html';

function populateLanguages(parent: HTMLElement) {
    return ApiClient.getCultures().then((languages: CultureDto[]) => {
        populateLanguagesIntoSelect(parent.querySelector('#selectLanguage'), languages);
        populateLanguagesIntoList(parent.querySelector('.subtitleDownloadLanguages'), languages);
    });
}

function populateLanguagesIntoSelect(select: HTMLSelectElement, languages: CultureDto[]) {
    let html = '';
    html += "<option value=''></option>";
    for (const culture of languages) {
        html += `<option value='${culture.Name}' data-culture-name='${culture.Name}'>${culture.DisplayName}</option>`;
    }
    select.innerHTML = html;
}

function populateLanguagesIntoList(element: HTMLElement, languages: CultureDto[]) {
    let html = '';
    for (const culture of languages) {
        html += `<label><input type="checkbox" is="emby-checkbox" class="chkSubtitleLanguage" data-lang="${culture.ThreeLetterISOLanguageName.toLowerCase()}" /><span>${culture.DisplayName}</span></label>`;
    }
    element.innerHTML = html;
}

function populateCountries(select: HTMLSelectElement) {
    return ApiClient.getCountries().then((allCountries: CountryInfo[]) => {
        let html = '';
        html += "<option value=''></option>";
        for (const culture of allCountries) {
            html += `<option value='${culture.TwoLetterISORegionName}'>${culture.DisplayName}</option>`;
        }
        select.innerHTML = html;
    });
}

function getDefaultMetadataLanguage(countryCode: string) {
    if (!countryCode) {
        return Promise.resolve('');
    }

    return ApiClient.getJSON(ApiClient.getUrl('Localization/DefaultMetadataLanguage', {
        countryCode
    })).then((language: string) => {
        return language || '';
    }).catch(() => {
        return '';
    });
}

function syncMetadataLanguageFromCountry(parent: HTMLElement) {
    const countryCode = parent.querySelector('#selectCountry').value;
    const selectLanguage = parent.querySelector('#selectLanguage');
    if (!countryCode || !selectLanguage) {
        return Promise.resolve('');
    }

    if (selectLanguage.value) {
        return Promise.resolve(selectLanguage.value);
    }

    return getDefaultMetadataLanguage(countryCode).then((language: string) => {
        if (countryCode.toUpperCase() === 'BR') {
            const preferredOption = Array.prototype.find.call(selectLanguage.options, (option: any) => {
                return (option.textContent || option.innerText || '').trim() === 'Portuguese (Brazil)';
            });
            if (preferredOption) {
                selectLanguage.value = preferredOption.value;
                return preferredOption.value;
            }
        }

        if (language) {
            selectLanguage.value = language;
        }

        return selectLanguage.value || language;
    });
}

function getNewLibraryOptions(serverConfiguration: Partial<ServerConfiguration>) {
    serverConfiguration = serverConfiguration || {};
    const countryCode = serverConfiguration.MetadataCountryCode || '';
    const preferredLanguage = serverConfiguration.PreferredMetadataLanguage || '';

    return {
        Enabled: true,
        EnablePhotos: true,
        EnableRealtimeMonitor: true,
        EnableLUFSScan: false,
        EnableChapterImageExtraction: false,
        ExtractChapterImagesDuringLibraryScan: false,
        EnableTrickplayImageExtraction: false,
        ExtractTrickplayImagesDuringLibraryScan: false,
        PathInfos: [],
        SaveLocalMetadata: false,
        EnableInternetProviders: true,
        EnableAutomaticSeriesGrouping: true,
        EnableEmbeddedTitles: false,
        EnableEmbeddedExtrasTitles: false,
        EnableEmbeddedEpisodeInfos: false,
        AutomaticRefreshIntervalDays: 0,
        PreferredMetadataLanguage: preferredLanguage || '',
        MetadataCountryCode: countryCode,
        SeasonZeroDisplayName: 'Specials',
        MetadataSavers: [],
        DisabledLocalMetadataReaders: [],
        LocalMetadataReaderOrder: [],
        DisabledSubtitleFetchers: [],
        SubtitleFetcherOrder: [],
        DisabledMediaSegmentProviders: [],
        MediaSegmentProviderOrder: [],
        SkipSubtitlesIfEmbeddedSubtitlesPresent: false,
        SkipSubtitlesIfAudioTrackMatches: true,
        SubtitleDownloadLanguages: [],
        RequirePerfectSubtitleMatch: true,
        SaveSubtitlesWithMedia: true,
        SaveLyricsWithMedia: false,
        SaveTrickplayWithMedia: false,
        DisabledLyricFetchers: [],
        LyricFetcherOrder: [],
        PreferNonstandardArtistsTag: false,
        UseCustomTagDelimiters: false,
        CustomTagDelimiters: ['/', '|', ';', '\\'],
        DelimiterWhitelist: [],
        AutomaticallyAddToCollection: false,
        AllowEmbeddedSubtitles: 'AllowAll',
        TypeOptions: []
    };
}

function populateRefreshInterval(select: HTMLSelectElement) {
    let html = '';
    html += `<option value='0'>${globalize.translate('Never')}</option>`;
    html += [30, 60, 90].map((val: number) => {
        return `<option value='${val}'>${globalize.translate('EveryNDays', val)}</option>`;
    }).join('');
    select.innerHTML = html;
}

function renderMetadataReaders(page: HTMLElement, plugins: LibraryOptionInfoDto[]) {
    let html = '';
    const elem = page.querySelector('.metadataReaders');

    if (plugins.length < 1) {
        elem.innerHTML = '';
        elem.classList.add('hide');
        return false;
    }

    html += `<h3 class="checkboxListLabel">${globalize.translate('LabelMetadataReaders')}</h3>`;
    html += '<div class="checkboxList paperList checkboxList-paperList">';
    for (let i = 0; i < plugins.length; i++) {
        const plugin = plugins[i];
        html += `<div class="listItem localReaderOption sortableOption" data-pluginname="${escapeHtml(plugin.Name)}">`;
        html += '<span class="listItemIcon material-icons live_tv" aria-hidden="true"></span>';
        html += '<div class="listItemBody">';
        html += '<h3 class="listItemBodyText">';
        html += escapeHtml(plugin.Name);
        html += '</h3>';
        html += '</div>';
        if (i > 0) {
            html += `<button type="button" is="paper-icon-button-light" title="${globalize.translate('Up')}" class="btnSortableMoveUp btnSortable" data-pluginindex="${i}"><span class="material-icons keyboard_arrow_up" aria-hidden="true"></span></button>`;
        } else if (plugins.length > 1) {
            html += `<button type="button" is="paper-icon-button-light" title="${globalize.translate('Down')}" class="btnSortableMoveDown btnSortable" data-pluginindex="${i}"><span class="material-icons keyboard_arrow_down" aria-hidden="true"></span></button>`;
        }
        html += '</div>';
    }
    html += '</div>';
    html += `<div class="fieldDescription">${globalize.translate('LabelMetadataReadersHelp')}</div>`;
    if (plugins.length < 2) {
        elem.classList.add('hide');
    } else {
        elem.classList.remove('hide');
    }
    elem.innerHTML = html;
    return true;
}

function renderMetadataSavers(page: HTMLElement, metadataSavers: LibraryOptionInfoDto[]) {
    let html = '';
    const elem = page.querySelector('.metadataSavers');
    if (!metadataSavers.length) {
        elem.innerHTML = '';
        elem.classList.add('hide');
        return false;
    }
    html += `<h3 class="checkboxListLabel">${globalize.translate('LabelMetadataSavers')}</h3>`;
    html += '<div class="checkboxList paperList checkboxList-paperList">';
    for (const plugin of metadataSavers) {
        html += `<label><input type="checkbox" data-defaultenabled="${plugin.DefaultEnabled}" is="emby-checkbox" class="chkMetadataSaver" data-pluginname="${escapeHtml(plugin.Name)}" ${false}><span>${escapeHtml(plugin.Name)}</span></label>`;
    }
    html += '</div>';
    html += `<div class="fieldDescription" style="margin-top:.25em;">${globalize.translate('LabelMetadataSaversHelp')}</div>`;
    elem.innerHTML = html;
    elem.classList.remove('hide');
    return true;
}

function getMetadataFetchersForTypeHtml(availableTypeOptions: AvailableTypeOption, libraryOptionsForType: EditorTypeOptions) {
    let html = '';
    let plugins = availableTypeOptions.MetadataFetchers;

    plugins = getOrderedPlugins(plugins, libraryOptionsForType.MetadataFetcherOrder || []);
    if (!plugins.length) return html;

    html += '<div class="metadataFetcher" data-type="' + availableTypeOptions.Type + '">';
    html += '<h3 class="checkboxListLabel">' + globalize.translate('LabelTypeMetadataDownloaders', globalize.translate('TypeOptionPlural' + availableTypeOptions.Type)) + '</h3>';
    html += '<div class="checkboxList paperList checkboxList-paperList">';

    plugins.forEach((plugin: LibraryOptionInfoDto, index: number) => {
        html += '<div class="listItem metadataFetcherItem sortableOption" data-pluginname="' + escapeHtml(plugin.Name) + '">';
        const isChecked = libraryOptionsForType.MetadataFetchers ? libraryOptionsForType.MetadataFetchers.includes(plugin.Name) : plugin.DefaultEnabled;
        const checkedHtml = isChecked ? ' checked="checked"' : '';
        html += '<label class="listItemCheckboxContainer"><input type="checkbox" is="emby-checkbox" class="chkMetadataFetcher" data-pluginname="' + escapeHtml(plugin.Name) + '" ' + checkedHtml + '><span></span></label>';
        html += '<div class="listItemBody">';
        html += '<h3 class="listItemBodyText">';
        html += escapeHtml(plugin.Name);
        html += '</h3>';
        html += '</div>';
        if (index > 0) {
            html += '<button type="button" is="paper-icon-button-light" title="' + globalize.translate('Up') + '" class="btnSortableMoveUp btnSortable" data-pluginindex="' + index + '"><span class="material-icons keyboard_arrow_up" aria-hidden="true"></span></button>';
        } else if (plugins.length > 1) {
            html += '<button type="button" is="paper-icon-button-light" title="' + globalize.translate('Down') + '" class="btnSortableMoveDown btnSortable" data-pluginindex="' + index + '"><span class="material-icons keyboard_arrow_down" aria-hidden="true"></span></button>';
        }
        html += '</div>';
    });

    html += '</div>';
    html += '<div class="fieldDescription">' + globalize.translate('LabelMetadataDownloadersHelp') + '</div>';
    html += '</div>';
    return html;
}

function getTypeOptions(allOptions: EditorLibraryOptions, type: string | null | undefined) {
    const allTypeOptions = allOptions.TypeOptions || [];
    for (const typeOptions of allTypeOptions) {
        if (typeOptions.Type === type) return typeOptions;
    }
    return null;
}

function renderMetadataFetchers(page: HTMLElement, availableOptions: AvailableLibraryOptions, libraryOptions: EditorLibraryOptions) {
    let html = '';
    const elem = page.querySelector('.metadataFetchers');
    for (const availableTypeOptions of availableOptions.TypeOptions) {
        html += getMetadataFetchersForTypeHtml(availableTypeOptions, getTypeOptions(libraryOptions, availableTypeOptions.Type) || {});
    }
    elem.innerHTML = html;
    if (html) {
        elem.classList.remove('hide');
        page.querySelector('.fldAutoRefreshInterval').classList.remove('hide');
        page.querySelector('.fldMetadataLanguage').classList.remove('hide');
        page.querySelector('.fldMetadataCountry').classList.remove('hide');
    } else {
        elem.classList.add('hide');
        page.querySelector('.fldAutoRefreshInterval').classList.add('hide');
        page.querySelector('.fldMetadataLanguage').classList.add('hide');
        page.querySelector('.fldMetadataCountry').classList.add('hide');
    }
    return true;
}

function renderSubtitleFetchers(page: HTMLElement, availableOptions: AvailableLibraryOptions, libraryOptions: EditorLibraryOptions) {
    let html = '';
    const elem = page.querySelector('.subtitleFetchers');

    let plugins = availableOptions.SubtitleFetchers;
    plugins = getOrderedPlugins(plugins, libraryOptions.SubtitleFetcherOrder || []);
    if (!plugins.length) return html;

    html += `<h3 class="checkboxListLabel">${globalize.translate('LabelSubtitleDownloaders')}</h3>`;
    html += '<div class="checkboxList paperList checkboxList-paperList">';
    for (let i = 0; i < plugins.length; i++) {
        const plugin = plugins[i];
        html += `<div class="listItem subtitleFetcherItem sortableOption" data-pluginname="${escapeHtml(plugin.Name)}">`;
        const isChecked = libraryOptions.DisabledSubtitleFetchers ? !libraryOptions.DisabledSubtitleFetchers.includes(plugin.Name) : plugin.DefaultEnabled;
        const checkedHtml = isChecked ? ' checked="checked"' : '';
        html += `<label class="listItemCheckboxContainer"><input type="checkbox" is="emby-checkbox" class="chkSubtitleFetcher" data-pluginname="${escapeHtml(plugin.Name)}" ${checkedHtml}><span></span></label>`;
        html += '<div class="listItemBody">';
        html += '<h3 class="listItemBodyText">';
        html += escapeHtml(plugin.Name);
        html += '</h3>';
        html += '</div>';
        if (i > 0) {
            html += `<button type="button" is="paper-icon-button-light" title="${globalize.translate('Up')}" class="btnSortableMoveUp btnSortable" data-pluginindex="${i}"><span class="material-icons keyboard_arrow_up" aria-hidden="true"></span></button>`;
        } else if (plugins.length > 1) {
            html += `<button type="button" is="paper-icon-button-light" title="${globalize.translate('Down')}" class="btnSortableMoveDown btnSortable" data-pluginindex="${i}"><span class="material-icons keyboard_arrow_down" aria-hidden="true"></span></button>`;
        }
        html += '</div>';
    }
    html += '</div>';
    html += `<div class="fieldDescription">${globalize.translate('SubtitleDownloadersHelp')}</div>`;
    elem.innerHTML = html;
}

function renderLyricFetchers(page: HTMLElement, availableOptions: AvailableLibraryOptions, libraryOptions: EditorLibraryOptions) {
    let html = '';
    const elem = page.querySelector('.lyricFetchers');

    let plugins = availableOptions.LyricFetchers;
    plugins = getOrderedPlugins(plugins, libraryOptions.LyricFetcherOrder);
    if (!plugins.length) return html;

    html += `<h3 class="checkboxListLabel">${globalize.translate('LabelLyricDownloaders')}</h3>`;
    html += '<div class="checkboxList paperList checkboxList-paperList">';
    for (let i = 0; i < plugins.length; i++) {
        const plugin = plugins[i];
        html += `<div class="listItem lyricFetcherItem sortableOption" data-pluginname="${escapeHtml(plugin.Name)}">`;
        const isChecked = libraryOptions.DisabledLyricFetchers ? !libraryOptions.DisabledLyricFetchers.includes(plugin.Name) : plugin.DefaultEnabled;
        const checkedHtml = isChecked ? ' checked="checked"' : '';
        html += `<label class="listItemCheckboxContainer"><input type="checkbox" is="emby-checkbox" class="chkLyricFetcher" data-pluginname="${escapeHtml(plugin.Name)}" ${checkedHtml}><span></span></label>`;
        html += '<div class="listItemBody">';
        html += '<h3 class="listItemBodyText">';
        html += escapeHtml(plugin.Name);
        html += '</h3>';
        html += '</div>';
        if (i > 0) {
            html += `<button type="button" is="paper-icon-button-light" title="${globalize.translate('Up')}" class="btnSortableMoveUp btnSortable" data-pluginindex="${i}"><span class="material-icons keyboard_arrow_up" aria-hidden="true"></span></button>`;
        } else if (plugins.length > 1) {
            html += `<button type="button" is="paper-icon-button-light" title="${globalize.translate('Down')}" class="btnSortableMoveDown btnSortable" data-pluginindex="${i}"><span class="material-icons keyboard_arrow_down" aria-hidden="true"></span></button>`;
        }
        html += '</div>';
    }
    html += '</div>';
    html += `<div class="fieldDescription">${globalize.translate('LyricDownloadersHelp')}</div>`;
    elem.innerHTML = html;
}

function renderMediaSegmentProviders(page: HTMLElement, availableOptions: AvailableLibraryOptions, libraryOptions: EditorLibraryOptions) {
    let html = '';
    const elem = page.querySelector('.mediaSegmentProviders');

    let plugins = availableOptions.MediaSegmentProviders;
    plugins = getOrderedPlugins(plugins, libraryOptions.MediaSegmentProviderOrder);
    elem.classList.toggle('hide', !plugins.length);
    if (!plugins.length) return html;

    html += `<h3 class="checkboxListLabel">${globalize.translate('LabelMediaSegmentProviders')}</h3>`;
    html += '<div class="checkboxList paperList checkboxList-paperList">';
    for (let i = 0; i < plugins.length; i++) {
        const plugin = plugins[i];
        html += `<div class="listItem mediaSegmentProviderItem sortableOption" data-pluginname="${escapeHtml(plugin.Name)}">`;
        const isChecked = libraryOptions.DisabledMediaSegmentProviders ? !libraryOptions.DisabledMediaSegmentProviders.includes(plugin.Name) : plugin.DefaultEnabled;
        const checkedHtml = isChecked ? ' checked="checked"' : '';
        html += `<label class="listItemCheckboxContainer"><input type="checkbox" is="emby-checkbox" class="chkMediaSegmentProvider" data-pluginname="${escapeHtml(plugin.Name)}" ${checkedHtml}><span></span></label>`;
        html += '<div class="listItemBody">';
        html += '<h3 class="listItemBodyText">';
        html += escapeHtml(plugin.Name);
        html += '</h3>';
        html += '</div>';
        if (i > 0) {
            html += `<button type="button" is="paper-icon-button-light" title="${globalize.translate('Up')}" class="btnSortableMoveUp btnSortable" data-pluginindex="${i}"><span class="material-icons keyboard_arrow_up" aria-hidden="true"></span></button>`;
        } else if (plugins.length > 1) {
            html += `<button type="button" is="paper-icon-button-light" title="${globalize.translate('Down')}" class="btnSortableMoveDown btnSortable" data-pluginindex="${i}"><span class="material-icons keyboard_arrow_down" aria-hidden="true"></span></button>`;
        }
        html += '</div>';
    }
    html += '</div>';
    html += `<div class="fieldDescription">${globalize.translate('MediaSegmentProvidersHelp')}</div>`;
    elem.innerHTML = html;
}

function getImageFetchersForTypeHtml(availableTypeOptions: AvailableTypeOption, libraryOptionsForType: EditorTypeOptions) {
    let html = '';
    let plugins = availableTypeOptions.ImageFetchers;

    plugins = getOrderedPlugins(plugins, libraryOptionsForType.ImageFetcherOrder || []);
    if (!plugins.length) return html;

    html += '<div class="imageFetcher" data-type="' + availableTypeOptions.Type + '">';
    html += '<div class="flex align-items-center" style="margin:1.5em 0 .5em;">';
    html += '<h3 class="checkboxListLabel" style="margin:0;">' + globalize.translate('HeaderTypeImageFetchers', globalize.translate('TypeOptionPlural' + availableTypeOptions.Type)) + '</h3>';
    const supportedImageTypes = availableTypeOptions.SupportedImageTypes || [];
    if (supportedImageTypes.length > 1 || supportedImageTypes.length === 1 && supportedImageTypes[0] !== 'Primary') {
        html += '<button is="emby-button" class="raised btnImageOptionsForType" type="button" style="font-size:90%;"><span>' + globalize.translate('HeaderFetcherSettings') + '</span></button>';
    }
    html += '</div>';
    html += '<div class="checkboxList paperList checkboxList-paperList">';
    for (let i = 0; i < plugins.length; i++) {
        const plugin = plugins[i];
        html += '<div class="listItem imageFetcherItem sortableOption" data-pluginname="' + escapeHtml(plugin.Name) + '">';
        const isChecked = libraryOptionsForType.ImageFetchers ? libraryOptionsForType.ImageFetchers.includes(plugin.Name) : plugin.DefaultEnabled;
        const checkedHtml = isChecked ? ' checked="checked"' : '';
        html += '<label class="listItemCheckboxContainer"><input type="checkbox" is="emby-checkbox" class="chkImageFetcher" data-pluginname="' + escapeHtml(plugin.Name) + '" ' + checkedHtml + '><span></span></label>';
        html += '<div class="listItemBody">';
        html += '<h3 class="listItemBodyText">';
        html += escapeHtml(plugin.Name);
        html += '</h3>';
        html += '</div>';
        if (i > 0) {
            html += '<button type="button" is="paper-icon-button-light" title="' + globalize.translate('Up') + '" class="btnSortableMoveUp btnSortable" data-pluginindex="' + i + '"><span class="material-icons keyboard_arrow_up" aria-hidden="true"></span></button>';
        } else if (plugins.length > 1) {
            html += '<button type="button" is="paper-icon-button-light" title="' + globalize.translate('Down') + '" class="btnSortableMoveDown btnSortable" data-pluginindex="' + i + '"><span class="material-icons keyboard_arrow_down" aria-hidden="true"></span></button>';
        }
        html += '</div>';
    }
    html += '</div>';
    html += '<div class="fieldDescription">' + globalize.translate('LabelImageFetchersHelp') + '</div>';
    html += '</div>';
    return html;
}

function getSimilarItemProvidersForTypeHtml(availableTypeOptions: AvailableTypeOption, libraryOptionsForType: EditorTypeOptions) {
    let html = '';
    let plugins = availableTypeOptions.SimilarItemProviders;

    plugins = getOrderedPlugins(plugins, libraryOptionsForType.SimilarItemProviderOrder || []);
    if (!plugins.length) return html;

    html += '<div class="similarItemProvider" data-type="' + availableTypeOptions.Type + '">';
    html += '<h3 class="checkboxListLabel">' + globalize.translate('HeaderTypeSimilarItemProviders', globalize.translate('TypeOptionPlural' + availableTypeOptions.Type)) + '</h3>';
    html += '<div class="checkboxList paperList checkboxList-paperList">';

    plugins.forEach((plugin: LibraryOptionInfoDto, index: number) => {
        html += '<div class="listItem similarItemProviderItem sortableOption" data-pluginname="' + escapeHtml(plugin.Name) + '">';
        const isChecked = libraryOptionsForType.SimilarItemProviders ? libraryOptionsForType.SimilarItemProviders.includes(plugin.Name) : plugin.DefaultEnabled;
        const checkedHtml = isChecked ? ' checked="checked"' : '';
        html += '<label class="listItemCheckboxContainer"><input type="checkbox" is="emby-checkbox" class="chkSimilarItemProvider" data-pluginname="' + escapeHtml(plugin.Name) + '" ' + checkedHtml + '><span></span></label>';
        html += '<div class="listItemBody">';
        html += '<h3 class="listItemBodyText">';
        html += escapeHtml(plugin.Name);
        html += '</h3>';
        html += '</div>';
        if (index > 0) {
            html += '<button type="button" is="paper-icon-button-light" title="' + globalize.translate('Up') + '" class="btnSortableMoveUp btnSortable" data-pluginindex="' + index + '"><span class="material-icons keyboard_arrow_up" aria-hidden="true"></span></button>';
        } else if (plugins.length > 1) {
            html += '<button type="button" is="paper-icon-button-light" title="' + globalize.translate('Down') + '" class="btnSortableMoveDown btnSortable" data-pluginindex="' + index + '"><span class="material-icons keyboard_arrow_down" aria-hidden="true"></span></button>';
        }
        html += '</div>';
    });

    html += '</div>';
    html += '<div class="fieldDescription">' + globalize.translate('LabelSimilarItemProvidersHelp') + '</div>';
    html += '</div>';
    return html;
}

function renderImageFetchers(page: HTMLElement, availableOptions: AvailableLibraryOptions, libraryOptions: EditorLibraryOptions) {
    let html = '';
    const elem = page.querySelector('.imageFetchers');
    for (const availableTypeOptions of availableOptions.TypeOptions) {
        html += getImageFetchersForTypeHtml(availableTypeOptions, getTypeOptions(libraryOptions, availableTypeOptions.Type) || {});
    }
    elem.innerHTML = html;
    if (html) {
        elem.classList.remove('hide');
        page.querySelector('.chkSaveLocalContainer').classList.remove('hide');
    } else {
        elem.classList.add('hide');
        page.querySelector('.chkSaveLocalContainer').classList.add('hide');
    }
    return true;
}

function renderSimilarItemProviders(page: HTMLElement, availableOptions: AvailableLibraryOptions, libraryOptions: EditorLibraryOptions) {
    let html = '';
    const elem = page.querySelector('.similarItemProviders');
    for (const availableTypeOptions of availableOptions.TypeOptions) {
        html += getSimilarItemProvidersForTypeHtml(availableTypeOptions, getTypeOptions(libraryOptions, availableTypeOptions.Type) || {});
    }
    elem.innerHTML = html;
    if (html) {
        elem.classList.remove('hide');
    } else {
        elem.classList.add('hide');
    }
    return true;
}

function populateMetadataSettings(parent: HTMLElement, contentType: string) {
    const isNewLibrary = parent.classList.contains('newlibrary');
    return ApiClient.getJSON(ApiClient.getUrl('Libraries/AvailableOptions', {
        LibraryContentType: contentType,
        IsNewLibrary: isNewLibrary
    })).then((availableOptions: any) => {
        currentAvailableOptions = availableOptions;
        parent.availableOptions = availableOptions;
        renderMetadataSavers(parent, availableOptions.MetadataSavers);
        renderMetadataReaders(parent, availableOptions.MetadataReaders);
        renderMetadataFetchers(parent, availableOptions, {});
        renderSubtitleFetchers(parent, availableOptions, {});
        renderLyricFetchers(parent, availableOptions, {});
        renderMediaSegmentProviders(parent, availableOptions, {});
        renderImageFetchers(parent, availableOptions, {});
        renderSimilarItemProviders(parent, availableOptions, {});
        availableOptions.SubtitleFetchers.length ? parent.querySelector('.subtitleDownloadSettings').classList.remove('hide') : parent.querySelector('.subtitleDownloadSettings').classList.add('hide');
    }).catch(() => {
        return Promise.resolve();
    });
}

function adjustSortableListElement(elem: HTMLElement) {
    const btnSortable = elem.querySelector('.btnSortable');
    const inner = btnSortable.querySelector('.material-icons');
    if (elem.previousSibling) {
        btnSortable.title = globalize.translate('Up');
        btnSortable.classList.add('btnSortableMoveUp');
        btnSortable.classList.remove('btnSortableMoveDown');
        inner.classList.remove('keyboard_arrow_down');
        inner.classList.add('keyboard_arrow_up');
    } else {
        btnSortable.title = globalize.translate('Down');
        btnSortable.classList.remove('btnSortableMoveUp');
        btnSortable.classList.add('btnSortableMoveDown');
        inner.classList.remove('keyboard_arrow_up');
        inner.classList.add('keyboard_arrow_down');
    }
}

function showImageOptionsForType(type: string) {
    import('../imageOptionsEditor/imageOptionsEditor').then(({ default: ImageOptionsEditor }) => {
        let typeOptions = getTypeOptions(currentLibraryOptions, type);
        if (!typeOptions) {
            typeOptions = {
                Type: type
            };
            currentLibraryOptions.TypeOptions.push(typeOptions);
        }
        const availableOptions = getTypeOptions(currentAvailableOptions || {}, type);
        const imageOptionsEditor = new ImageOptionsEditor();
        imageOptionsEditor.show(type, typeOptions, availableOptions);
    });
}

function onImageFetchersContainerClick(this: HTMLElement, e: Event) {
    const btnImageOptionsForType = dom.parentWithClass(e.target, 'btnImageOptionsForType') as HTMLElement | null;
    if (btnImageOptionsForType) {
        const imageFetcher = dom.parentWithClass(btnImageOptionsForType, 'imageFetcher') as HTMLElement | null;
        if (!imageFetcher) {
            return;
        }
        showImageOptionsForType(imageFetcher.getAttribute('data-type'));
        return;
    }
    onSortableContainerClick.call(this, e);
}

function onSortableContainerClick(this: HTMLElement, e: Event) {
    const btnSortable = dom.parentWithClass(e.target, 'btnSortable') as HTMLElement | null;
    if (btnSortable) {
        const li = dom.parentWithClass(btnSortable, 'sortableOption') as HTMLElement | null;
        if (!li) {
            return;
        }
        const list = dom.parentWithClass(li, 'paperList') as HTMLElement | null;
        if (!list) {
            return;
        }
        if (btnSortable.classList.contains('btnSortableMoveDown')) {
            const next = li.nextSibling;
            if (next) {
                const parentNode = li.parentNode;
                const nextParent = next.parentNode;
                if (!parentNode || !nextParent) {
                    return;
                }
                parentNode.removeChild(li);
                nextParent.insertBefore(li, next.nextSibling);
            }
        } else {
            const prev = li.previousSibling;
            if (prev) {
                const parentNode = li.parentNode;
                const prevParent = prev.parentNode;
                if (!parentNode || !prevParent) {
                    return;
                }
                parentNode.removeChild(li);
                prevParent.insertBefore(li, prev);
            }
        }
        Array.prototype.forEach.call(list.querySelectorAll('.sortableOption'), adjustSortableListElement);
    }
}

function bindEvents(parent: HTMLElement) {
    parent.querySelector('.metadataReaders').addEventListener('click', onSortableContainerClick);
    parent.querySelector('.subtitleFetchers').addEventListener('click', onSortableContainerClick);
    parent.querySelector('.metadataFetchers').addEventListener('click', onSortableContainerClick);
    parent.querySelector('.lyricFetchers').addEventListener('click', onSortableContainerClick);
    parent.querySelector('.mediaSegmentProviders').addEventListener('click', onSortableContainerClick);
    parent.querySelector('.imageFetchers').addEventListener('click', onImageFetchersContainerClick);
    parent.querySelector('.similarItemProviders').addEventListener('click', onSortableContainerClick);
    parent.querySelector('#selectCountry').addEventListener('change', () => {
        void syncMetadataLanguageFromCountry(parent);
    });

    parent.querySelector('#chkEnableEmbeddedTitles').addEventListener('change', (e: Event) => {
        parent.querySelector('.chkEnableEmbeddedExtrasTitlesContainer').classList.toggle('hide', !e.currentTarget.checked);
    });
}

export async function embed(parent: HTMLElement, contentType: string | null | undefined, libraryOptions: EditorLibraryOptions | null) {
    currentLibraryOptions = {
        TypeOptions: []
    };
    currentAvailableOptions = null;
    const isNewLibrary = libraryOptions == null;
    isNewLibrary && parent.classList.add('newlibrary');

    parent.innerHTML = globalize.translateHtml(template);
    populateRefreshInterval(parent.querySelector('#selectAutoRefreshInterval'));
    const promises = [populateLanguages(parent), populateCountries(parent.querySelector('#selectCountry'))];
    if (isNewLibrary) {
        promises.push(ApiClient.getJSON(ApiClient.getUrl('Startup/Configuration')).catch((err: any) => {
            console.warn('[libraryoptionseditor] Failed to fetch Startup/Configuration:', err);
            return null;
        }));
    }
    Promise.all(promises).then(function (responses: any) {
        const serverConfiguration = isNewLibrary ? responses[2] || {} : null;
        return setContentType(parent, contentType).then(function() {
            setLibraryOptions(parent, libraryOptions || getNewLibraryOptions(serverConfiguration));
            bindEvents(parent);
        });
    });
}

const CHAPTER_CONTENT_TYPES = [
    CollectionType.Homevideos,
    CollectionType.Movies,
    CollectionType.Musicvideos,
    CollectionType.Tvshows
];

export function setContentType(parent: HTMLElement, contentType: string | undefined) {
    if (contentType === 'homevideos' || contentType === 'photos') {
        parent.querySelector('.chkEnablePhotosContainer').classList.remove('hide');
    } else {
        parent.querySelector('.chkEnablePhotosContainer').classList.add('hide');
    }

    const hasChapterOptions = !contentType /* Mixed */ || CHAPTER_CONTENT_TYPES.includes(contentType);
    parent.querySelector('.trickplaySettingsSection').classList.toggle('hide', !hasChapterOptions);
    parent.querySelector('.chapterSettingsSection').classList.toggle('hide', !hasChapterOptions);

    if (contentType === 'tvshows') {
        parent.querySelector('.chkAutomaticallyGroupSeriesContainer').classList.remove('hide');
        parent.querySelector('.fldSeasonZeroDisplayName').classList.remove('hide');
        parent.querySelector('#txtSeasonZeroName').setAttribute('required', 'required');
    } else {
        parent.querySelector('.chkAutomaticallyGroupSeriesContainer').classList.add('hide');
        parent.querySelector('.fldSeasonZeroDisplayName').classList.add('hide');
        parent.querySelector('#txtSeasonZeroName').removeAttribute('required');
    }

    if (contentType === 'books' || contentType === 'boxsets' || contentType === 'playlists' || contentType === 'music') {
        parent.querySelector('.chkEnableEmbeddedTitlesContainer').classList.add('hide');
        parent.querySelector('.chkEnableEmbeddedExtrasTitlesContainer').classList.add('hide');
    } else {
        parent.querySelector('.chkEnableEmbeddedTitlesContainer').classList.remove('hide');
        if (parent.querySelector('#chkEnableEmbeddedTitles').checked) {
            parent.querySelector('.chkEnableEmbeddedExtrasTitlesContainer').classList.remove('hide');
        }
    }

    parent.querySelector('.chkEnableLUFSScanContainer').classList.toggle('hide', contentType !== 'music');

    if (contentType === 'tvshows') {
        parent.querySelector('.chkEnableEmbeddedEpisodeInfosContainer').classList.remove('hide');
    } else {
        parent.querySelector('.chkEnableEmbeddedEpisodeInfosContainer').classList.add('hide');
    }

    if (contentType === 'tvshows' || contentType === 'movies' || contentType === 'musicvideos' || contentType === 'mixed') {
        parent.querySelector('.fldAllowEmbeddedSubtitlesContainer').classList.remove('hide');
    } else {
        parent.querySelector('.fldAllowEmbeddedSubtitlesContainer').classList.add('hide');
    }

    if (contentType === 'music') {
        parent.querySelector('.lyricSettingsSection').classList.remove('hide');
        parent.querySelector('.audioTagSettingsSection').classList.remove('hide');
    } else {
        parent.querySelector('.lyricSettingsSection').classList.add('hide');
        parent.querySelector('.audioTagSettingsSection').classList.add('hide');
    }

    parent.querySelector('.chkAutomaticallyAddToCollectionContainer').classList.toggle('hide', contentType !== 'movies' && contentType !== 'mixed');

    return populateMetadataSettings(parent, contentType);
}

function setSubtitleFetchersIntoOptions(parent: any, options: any) {
    options.DisabledSubtitleFetchers = Array.prototype.map.call(Array.prototype.filter.call(parent.querySelectorAll('.chkSubtitleFetcher'), (elem: any) => {
        return !elem.checked;
    }), (elem: any) => {
        return elem.getAttribute('data-pluginname');
    });

    options.SubtitleFetcherOrder = Array.prototype.map.call(parent.querySelectorAll('.subtitleFetcherItem'), (elem: any) => {
        return elem.getAttribute('data-pluginname');
    });
}

function setLyricFetchersIntoOptions(parent: any, options: any) {
    options.DisabledLyricFetchers = Array.prototype.map.call(Array.prototype.filter.call(parent.querySelectorAll('.chkLyricFetcher'), (elem: any) => {
        return !elem.checked;
    }), (elem: any) => {
        return elem.getAttribute('data-pluginname');
    });

    options.LyricFetcherOrder = Array.prototype.map.call(parent.querySelectorAll('.lyricFetcherItem'), (elem: any) => {
        return elem.getAttribute('data-pluginname');
    });
}

function setMediaSegmentProvidersIntoOptions(parent: any, options: any) {
    options.DisabledMediaSegmentProviders = Array.prototype.map.call(Array.prototype.filter.call(parent.querySelectorAll('.chkMediaSegmentProvider'), (elem: any) => {
        return !elem.checked;
    }), (elem: any) => {
        return elem.getAttribute('data-pluginname');
    });

    options.MediaSegmentProviderOrder = Array.prototype.map.call(parent.querySelectorAll('.mediaSegmentProviderItem'), (elem: any) => {
        return elem.getAttribute('data-pluginname');
    });
}

function setMetadataFetchersIntoOptions(parent: any, options: any) {
    const sections = parent.querySelectorAll('.metadataFetcher');
    for (const section of sections) {
        const type = section.getAttribute('data-type');
        let typeOptions = getTypeOptions(options, type);
        if (!typeOptions) {
            typeOptions = {
                Type: type
            };
            options.TypeOptions.push(typeOptions);
        }
        typeOptions.MetadataFetchers = Array.prototype.map.call(Array.prototype.filter.call(section.querySelectorAll('.chkMetadataFetcher'), (elem: any) => {
            return elem.checked;
        }), (elem: any) => {
            return elem.getAttribute('data-pluginname');
        });

        typeOptions.MetadataFetcherOrder = Array.prototype.map.call(section.querySelectorAll('.metadataFetcherItem'), (elem: any) => {
            return elem.getAttribute('data-pluginname');
        });
    }
}

function setImageFetchersIntoOptions(parent: any, options: any) {
    const sections = parent.querySelectorAll('.imageFetcher');
    for (const section of sections) {
        const type = section.getAttribute('data-type');
        let typeOptions = getTypeOptions(options, type);
        if (!typeOptions) {
            typeOptions = {
                Type: type
            };
            options.TypeOptions.push(typeOptions);
        }

        typeOptions.ImageFetchers = Array.prototype.map.call(Array.prototype.filter.call(section.querySelectorAll('.chkImageFetcher'), (elem: any) => {
            return elem.checked;
        }), (elem: any) => {
            return elem.getAttribute('data-pluginname');
        });

        typeOptions.ImageFetcherOrder = Array.prototype.map.call(section.querySelectorAll('.imageFetcherItem'), (elem: any) => {
            return elem.getAttribute('data-pluginname');
        });
    }
}

function setSimilarItemProvidersIntoOptions(parent: any, options: any) {
    const sections = parent.querySelectorAll('.similarItemProvider');
    for (const section of sections) {
        const type = section.getAttribute('data-type');
        let typeOptions = getTypeOptions(options, type);
        if (!typeOptions) {
            typeOptions = {
                Type: type
            };
            options.TypeOptions.push(typeOptions);
        }

        typeOptions.SimilarItemProviders = Array.prototype.map.call(Array.prototype.filter.call(section.querySelectorAll('.chkSimilarItemProvider'), (elem: any) => {
            return elem.checked;
        }), (elem: any) => {
            return elem.getAttribute('data-pluginname');
        });

        typeOptions.SimilarItemProviderOrder = Array.prototype.map.call(section.querySelectorAll('.similarItemProviderItem'), (elem: any) => {
            return elem.getAttribute('data-pluginname');
        });
    }
}

function setImageOptionsIntoOptions(options: EditorLibraryOptions) {
    const originalTypeOptions: EditorTypeOptions[] = currentLibraryOptions?.TypeOptions || [];
    for (const originalTypeOption of originalTypeOptions) {
        let typeOptions = getTypeOptions(options, originalTypeOption.Type);

        if (!typeOptions) {
            typeOptions = {
                Type: originalTypeOption.Type
            };
            options.TypeOptions.push(typeOptions);
        }
        originalTypeOption.ImageOptions && (typeOptions.ImageOptions = originalTypeOption.ImageOptions);
    }
}

export function getLibraryOptions(parent: HTMLElement): EditorLibraryOptions {
    const options: EditorLibraryOptions = {
        Enabled: parent.querySelector('.chkEnabled').checked,
        EnableArchiveMediaFiles: false,
        EnablePhotos: parent.querySelector('.chkEnablePhotos').checked,
        EnableRealtimeMonitor: true,
        EnableLUFSScan: parent.querySelector('.chkEnableLUFSScan').checked,
        ExtractTrickplayImagesDuringLibraryScan: parent.querySelector('.chkExtractTrickplayDuringLibraryScan').checked,
        SaveTrickplayWithMedia: parent.querySelector('.chkSaveTrickplayLocally').checked,
        EnableTrickplayImageExtraction: parent.querySelector('.chkExtractTrickplayImages').checked,
        ExtractChapterImagesDuringLibraryScan: parent.querySelector('.chkExtractChaptersDuringLibraryScan').checked,
        EnableChapterImageExtraction: parent.querySelector('.chkExtractChapterImages').checked,
        EnableInternetProviders: true,
        SaveLocalMetadata: parent.querySelector('#chkSaveLocal').checked,
        EnableAutomaticSeriesGrouping: parent.querySelector('.chkAutomaticallyGroupSeries').checked,
        PreferredMetadataLanguage: parent.querySelector('#selectLanguage').value,
        MetadataCountryCode: parent.querySelector('#selectCountry').value,
        SeasonZeroDisplayName: parent.querySelector('#txtSeasonZeroName').value,
        AutomaticRefreshIntervalDays: parseInt(parent.querySelector('#selectAutoRefreshInterval').value, 10),
        EnableEmbeddedTitles: parent.querySelector('#chkEnableEmbeddedTitles').checked,
        EnableEmbeddedExtrasTitles: parent.querySelector('#chkEnableEmbeddedExtrasTitles').checked,
        EnableEmbeddedEpisodeInfos: parent.querySelector('#chkEnableEmbeddedEpisodeInfos').checked,
        AllowEmbeddedSubtitles: parent.querySelector('#selectAllowEmbeddedSubtitles').value,
        SkipSubtitlesIfEmbeddedSubtitlesPresent: parent.querySelector('#chkSkipIfGraphicalSubsPresent').checked,
        SkipSubtitlesIfAudioTrackMatches: parent.querySelector('#chkSkipIfAudioTrackPresent').checked,
        SaveSubtitlesWithMedia: parent.querySelector('#chkSaveSubtitlesLocally').checked,
        SaveLyricsWithMedia: parent.querySelector('#chkSaveLyricsLocally').checked,
        RequirePerfectSubtitleMatch: parent.querySelector('#chkRequirePerfectMatch').checked,
        AutomaticallyAddToCollection: parent.querySelector('#chkAutomaticallyAddToCollection').checked,
        PreferNonstandardArtistsTag: parent.querySelector('#chkPreferNonstandardArtistsTag').checked,
        UseCustomTagDelimiters: parent.querySelector('#chkUseCustomTagDelimiters').checked,
        MetadataSavers: Array.prototype.map.call(Array.prototype.filter.call(parent.querySelectorAll('.chkMetadataSaver'), (elem: any) => {
            return elem.checked;
        }), (elem: any) => {
            return elem.getAttribute('data-pluginname');
        }),
        TypeOptions: []
    };

    options.LocalMetadataReaderOrder = Array.prototype.map.call(parent.querySelectorAll('.localReaderOption'), (elem: any) => {
        return elem.getAttribute('data-pluginname');
    });
    options.SubtitleDownloadLanguages = Array.prototype.map.call(Array.prototype.filter.call(parent.querySelectorAll('.chkSubtitleLanguage'), (elem: any) => {
        return elem.checked;
    }), (elem: any) => {
        return elem.getAttribute('data-lang');
    });
    options.CustomTagDelimiters = parent.querySelector('#customTagDelimitersInput').value.split('');
    options.DelimiterWhitelist = parent.querySelector('#tagDelimiterWhitelist').value.split('\n').filter((item: any) => item.trim());
    setSubtitleFetchersIntoOptions(parent, options);
    setLyricFetchersIntoOptions(parent, options);
    setMediaSegmentProvidersIntoOptions(parent, options);
    setMetadataFetchersIntoOptions(parent, options);
    setImageFetchersIntoOptions(parent, options);
    setSimilarItemProvidersIntoOptions(parent, options);
    setImageOptionsIntoOptions(options);

    return options;
}

function getOrderedPlugins(plugins: any = [], configuredOrder: any = []) {
    plugins = plugins.slice(0);
    plugins.sort((a: any, b: any) => {
        a = configuredOrder.indexOf(a.Name);
        b = configuredOrder.indexOf(b.Name);
        return a - b;
    });
    return plugins;
}

export function setLibraryOptions(parent: HTMLElement, options: EditorLibraryOptions) {
    currentLibraryOptions = options;
    currentAvailableOptions = parent.availableOptions;
    parent.querySelector('#selectLanguage').value = options.PreferredMetadataLanguage || '';
    parent.querySelector('#selectCountry').value = options.MetadataCountryCode || '';
    parent.querySelector('#selectAutoRefreshInterval').value = options.AutomaticRefreshIntervalDays || '0';
    parent.querySelector('#txtSeasonZeroName').value = options.SeasonZeroDisplayName || 'Specials';
    parent.querySelector('.chkEnabled').checked = options.Enabled;
    parent.querySelector('.chkEnablePhotos').checked = options.EnablePhotos;
    parent.querySelector('.chkEnableRealtimeMonitor').checked = true;
    parent.querySelector('.chkEnableRealtimeMonitor').disabled = true;
    parent.querySelector('.chkEnableLUFSScan').checked = options.EnableLUFSScan;
    parent.querySelector('.chkExtractTrickplayDuringLibraryScan').checked = options.ExtractTrickplayImagesDuringLibraryScan;
    parent.querySelector('.chkExtractTrickplayImages').checked = options.EnableTrickplayImageExtraction;
    parent.querySelector('.chkSaveTrickplayLocally').checked = options.SaveTrickplayWithMedia;
    parent.querySelector('.chkExtractChaptersDuringLibraryScan').checked = options.ExtractChapterImagesDuringLibraryScan;
    parent.querySelector('.chkExtractChapterImages').checked = options.EnableChapterImageExtraction;
    parent.querySelector('#chkSaveLocal').checked = options.SaveLocalMetadata;
    parent.querySelector('.chkAutomaticallyGroupSeries').checked = options.EnableAutomaticSeriesGrouping;
    parent.querySelector('#chkEnableEmbeddedTitles').checked = options.EnableEmbeddedTitles;
    parent.querySelector('.chkEnableEmbeddedExtrasTitlesContainer').classList.toggle('hide', !options.EnableEmbeddedTitles);
    parent.querySelector('#chkEnableEmbeddedExtrasTitles').checked = options.EnableEmbeddedExtrasTitles;
    parent.querySelector('#chkEnableEmbeddedEpisodeInfos').checked = options.EnableEmbeddedEpisodeInfos;
    parent.querySelector('#selectAllowEmbeddedSubtitles').value = options.AllowEmbeddedSubtitles;
    parent.querySelector('#chkSkipIfGraphicalSubsPresent').checked = options.SkipSubtitlesIfEmbeddedSubtitlesPresent;
    parent.querySelector('#chkSaveSubtitlesLocally').checked = options.SaveSubtitlesWithMedia;
    parent.querySelector('#chkSaveLyricsLocally').checked = options.SaveLyricsWithMedia;
    parent.querySelector('#chkSkipIfAudioTrackPresent').checked = options.SkipSubtitlesIfAudioTrackMatches;
    parent.querySelector('#chkRequirePerfectMatch').checked = options.RequirePerfectSubtitleMatch;
    parent.querySelector('#chkAutomaticallyAddToCollection').checked = options.AutomaticallyAddToCollection;
    parent.querySelector('#chkPreferNonstandardArtistsTag').checked = options.PreferNonstandardArtistsTag;
    parent.querySelector('#chkUseCustomTagDelimiters').checked = options.UseCustomTagDelimiters;
    Array.prototype.forEach.call(parent.querySelectorAll('.chkMetadataSaver'), (elem: any) => {
        elem.checked = options.MetadataSavers ? options.MetadataSavers.includes(elem.getAttribute('data-pluginname')) : elem.getAttribute('data-defaultenabled') === 'true';
    });
    Array.prototype.forEach.call(parent.querySelectorAll('.chkSubtitleLanguage'), (elem: any) => {
        elem.checked = !!options.SubtitleDownloadLanguages && options.SubtitleDownloadLanguages.includes(elem.getAttribute('data-lang'));
    });
    parent.querySelector('#customTagDelimitersInput').value = options.CustomTagDelimiters.join('');
    parent.querySelector('#tagDelimiterWhitelist').value = options.DelimiterWhitelist.filter((item: any) => item.trim()).join('\n');
    renderMetadataReaders(parent, getOrderedPlugins(parent.availableOptions.MetadataReaders, options.LocalMetadataReaderOrder || []));
    renderMetadataFetchers(parent, parent.availableOptions, options);
    renderImageFetchers(parent, parent.availableOptions, options);
    renderSimilarItemProviders(parent, parent.availableOptions, options);
    renderSubtitleFetchers(parent, parent.availableOptions, options);
    renderLyricFetchers(parent, parent.availableOptions, options);
    renderMediaSegmentProviders(parent, parent.availableOptions, options);

    if (options.MetadataCountryCode) {
        void syncMetadataLanguageFromCountry(parent);
    }
}

let currentLibraryOptions: EditorLibraryOptions | null;
let currentAvailableOptions: AvailableLibraryOptions | null;

export default {
    embed,
    setContentType,
    getLibraryOptions,
    setLibraryOptions
};



