import $ from 'jquery';
import DOMPurify from 'dompurify';
import loading from '../loading/loading';
import globalize from '../../lib/globalize';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-input/emby-input';
import '../listview/listview.scss';
import '../../elements/emby-button/paper-icon-button-light';
import Dashboard from '../../utils/dashboard';
import Events from '../../utils/events';
import dom from 'utils/dom';

interface TunerDevice {
    Id?: string;
    FriendlyName?: string;
    Type?: string;
    Url?: string;
    [key: string]: unknown;
}

interface ProviderInfo {
    Id?: string;
    Path?: string;
    KidsCategories?: string[];
    NewsCategories?: string[];
    SportsCategories?: string[];
    MovieCategories?: string[];
    MoviePrefix?: string | null;
    UserAgent?: string | null;
    EnableAllTuners?: boolean;
    EnabledTuners?: string[];
    Type?: string;
    [key: string]: unknown;
}

interface LiveTvConfig {
    ListingProviders: ProviderInfo[];
    TunerHosts: TunerDevice[];
    [key: string]: unknown;
}

interface Options {
    showConfirmation?: boolean;
    showCancelButton?: boolean;
    showSubmitButton?: boolean;
    [key: string]: unknown;
}

function getTunerName(providerId: string): string {
    switch (providerId.toLowerCase()) {
        case 'm3u':
            return 'M3U Playlist';
        case 'hdhomerun':
            return 'HDHomerun';
        case 'satip':
            return 'DVB';
        default:
            return 'Unknown';
    }
}

function refreshTunerDevices(page: HTMLElement, providerInfo: ProviderInfo, devices: TunerDevice[]): void {
    let html = '';

    for (let i = 0, length = devices.length; i < length; i++) {
        const device = devices[i];
        html += '<div class="listItem">';
        const enabledTuners = providerInfo.EnabledTuners || [];
        const isChecked = providerInfo.EnableAllTuners || enabledTuners.indexOf(device.Id || '') !== -1;
        const checkedAttribute = isChecked ? ' checked' : '';
        html += '<label class="listItemCheckboxContainer"><input type="checkbox" is="emby-checkbox" class="chkTuner" data-id="' + device.Id + '" ' + checkedAttribute + '><span></span></label>';
        html += '<div class="listItemBody two-line">';
        html += '<div class="listItemBodyText">';
        html += device.FriendlyName || getTunerName(device.Type || '');
        html += '</div>';
        html += '<div class="listItemBodyText secondary">';
        html += device.Url || '';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }

    page.querySelector('.tunerList')!.innerHTML = DOMPurify.sanitize(html);
}

function onSelectPathClick(e: Event): void {
    const target = (e as MouseEvent).target as HTMLElement;
    const page = dom.parentWithClass(target, 'xmltvForm')!;

    import('../directorybrowser/directorybrowser').then(({ default: DirectoryBrowser }) => {
        const picker = new DirectoryBrowser();
        picker.show({
            includeFiles: true,
            callback: function (path: string | null) {
                if (path) {
                    const txtPath = page.querySelector('.txtPath') as HTMLInputElement;
                    txtPath.value = path;
                    txtPath.focus();
                }
                picker.close();
            }
        });
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (this: any, page: HTMLElement, providerId: string, options: Options): void {
    function getListingProvider(config: LiveTvConfig | null, id: string | null): Promise<ProviderInfo> {
        if (config && id) {
            const result = config.ListingProviders.filter(function (provider) {
                return provider.Id === id;
            })[0];

            if (result) {
                return Promise.resolve(result);
            }

            return getListingProvider(null, null);
        }

        return (window.ApiClient as any).getJSON((window.ApiClient as any).getUrl('LiveTv/ListingProviders/Default'));
    }

    function reload(): void {
        loading.show();
        (window.ApiClient as any).getNamedConfiguration('livetv').then(function (config: LiveTvConfig) {
            getListingProvider(config, providerId).then(function (info: ProviderInfo) {
                (page.querySelector('.txtPath') as HTMLInputElement).value = info.Path || '';
                (page.querySelector('.txtKids') as HTMLInputElement).value = (info.KidsCategories || []).join('|');
                (page.querySelector('.txtNews') as HTMLInputElement).value = (info.NewsCategories || []).join('|');
                (page.querySelector('.txtSports') as HTMLInputElement).value = (info.SportsCategories || []).join('|');
                (page.querySelector('.txtMovies') as HTMLInputElement).value = (info.MovieCategories || []).join('|');
                (page.querySelector('.txtMoviePrefix') as HTMLInputElement).value = info.MoviePrefix || '';
                (page.querySelector('.txtUserAgent') as HTMLInputElement).value = info.UserAgent || '';
                (page.querySelector('.chkAllTuners') as HTMLInputElement).checked = !!info.EnableAllTuners;

                if ((page.querySelector('.chkAllTuners') as HTMLInputElement).checked) {
                    page.querySelector('.selectTunersSection')?.classList.add('hide');
                } else {
                    page.querySelector('.selectTunersSection')?.classList.remove('hide');
                }

                refreshTunerDevices(page, info, config.TunerHosts);
                loading.hide();
            });
        });
    }

    function getCategories(txtInput: HTMLInputElement): string[] {
        const value = txtInput.value;

        if (value) {
            return value.split('|');
        }

        return [];
    }

    function submitListingsForm(): void {
        loading.show();
        const id = providerId;
        (window.ApiClient as any).getNamedConfiguration('livetv').then(function (config: LiveTvConfig) {
            const info = config.ListingProviders.filter(function (provider) {
                return provider.Id === id;
            })[0] || {} as ProviderInfo;
            info.Type = 'xmltv';
            info.Path = (page.querySelector('.txtPath') as HTMLInputElement).value;
            info.MoviePrefix = (page.querySelector('.txtMoviePrefix') as HTMLInputElement).value || null;
            info.UserAgent = (page.querySelector('.txtUserAgent') as HTMLInputElement).value || null;
            info.MovieCategories = getCategories(page.querySelector('.txtMovies') as HTMLInputElement);
            info.KidsCategories = getCategories(page.querySelector('.txtKids') as HTMLInputElement);
            info.NewsCategories = getCategories(page.querySelector('.txtNews') as HTMLInputElement);
            info.SportsCategories = getCategories(page.querySelector('.txtSports') as HTMLInputElement);
            info.EnableAllTuners = (page.querySelector('.chkAllTuners') as HTMLInputElement).checked;
            info.EnabledTuners = info.EnableAllTuners ? [] : $('.chkTuner', page).get().filter(function (tuner: HTMLElement) {
                return (tuner as HTMLInputElement).checked;
            }).map(function (tuner: HTMLElement) {
                return (tuner as HTMLInputElement).getAttribute('data-id') || '';
            });
            (window.ApiClient as any).ajax({
                type: 'POST',
                url: (window.ApiClient as any).getUrl('LiveTv/ListingProviders', {
                    ValidateListings: true
                }),
                data: JSON.stringify(info),
                contentType: 'application/json'
            }).then(function () {
                loading.hide();

                if (options.showConfirmation !== false) {
                    Dashboard.processServerConfigurationUpdateResult();
                }

                Events.trigger(self as unknown as object, 'submitted');
            }, function () {
                loading.hide();
                Dashboard.alert({
                    message: globalize.translate('ErrorAddingXmlTvFile')
                });
            });
        });
    }

    const self: Record<string, unknown> = this;

    self.submit = function (): void {
        (page.querySelector('.btnSubmitListings') as HTMLElement)?.click();
    };

    self.init = function (): void {
        options = options || {} as Options;

        // Only hide the buttons if explicitly set to false; default to showing if undefined or null
        // FIXME: rename this option to clarify logic
        const hideCancelButton = options.showCancelButton === false;
        page.querySelector('.btnCancel')?.classList.toggle('hide', hideCancelButton);

        const hideSubmitButton = options.showSubmitButton === false;
        page.querySelector('.btnSubmitListings')?.classList.toggle('hide', hideSubmitButton);

        $('form', page).on('submit', function () {
            submitListingsForm();
            return false;
        });
        page.querySelector('#btnSelectPath')?.addEventListener('click', onSelectPathClick);
        page.querySelector('.chkAllTuners')?.addEventListener('change', function (evt: Event) {
            if ((evt.target as HTMLInputElement).checked) {
                page.querySelector('.selectTunersSection')?.classList.add('hide');
            } else {
                page.querySelector('.selectTunersSection')?.classList.remove('hide');
            }
        });
        reload();
    };
}
