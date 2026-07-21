import $ from 'jquery';
import DOMPurify from 'dompurify';
import loading from '../loading/loading';
import globalize from '../../lib/globalize';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-input/emby-input';
import '../listview/listview.scss';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-select/emby-select';
import '../../elements/emby-button/emby-button';
import '../../styles/flexstyles.scss';
import './style.scss';
import Dashboard from '../../utils/dashboard';
import Events from '../../utils/events';

interface TunerDevice {
    Id?: string;
    FriendlyName?: string;
    Type?: string;
    Url?: string;
    [key: string]: unknown;
}

interface ProviderInfo {
    Id?: string;
    ListingsId?: string;
    Username?: string;
    Password?: string;
    ZipCode?: string;
    Country?: string;
    EnableAllTuners?: boolean;
    EnabledTuners?: string[];
    [key: string]: unknown;
}

interface LiveTvConfig {
    ListingProviders: ProviderInfo[];
    TunerHosts: TunerDevice[];
    [key: string]: unknown;
}

interface CountryItem {
    name: string;
    value: string;
    fullName?: string;
    shortName?: string;
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
        html += '<label class="checkboxContainer listItemCheckboxContainer"><input type="checkbox" is="emby-checkbox" data-id="' + device.Id + '" class="chkTuner" ' + checkedAttribute + '/><span></span></label>';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (this: any, page: HTMLElement, providerId: string, options: Options): void {
    let listingsId: string | undefined;

    function reload(): void {
        loading.show();
        (window.ApiClient as any).getNamedConfiguration('livetv').then(function (config: LiveTvConfig) {
            const info = config.ListingProviders.filter(function (i) {
                return i.Id === providerId;
            })[0] || {};
            listingsId = info.ListingsId;
            (page.querySelector('#selectListing') as HTMLSelectElement).value = info.ListingsId || '';
            (page.querySelector('.txtUser') as HTMLInputElement).value = info.Username || '';
            (page.querySelector('.txtPass') as HTMLInputElement).value = '';
            (page.querySelector('.txtZipCode') as HTMLInputElement).value = info.ZipCode || '';

            if (info.Username && info.Password) {
                page.querySelector('.listingsSection')?.classList.remove('hide');
            } else {
                page.querySelector('.listingsSection')?.classList.add('hide');
            }

            (page.querySelector('.chkAllTuners') as HTMLInputElement).checked = !!info.EnableAllTuners;

            if (info.EnableAllTuners) {
                page.querySelector('.selectTunersSection')?.classList.add('hide');
            } else {
                page.querySelector('.selectTunersSection')?.classList.remove('hide');
            }

            setCountry(info);
            refreshTunerDevices(page, info, config.TunerHosts);
        });
    }

    function setCountry(info: ProviderInfo): void {
        (window.ApiClient as any).getJSON((window.ApiClient as any).getUrl('LiveTv/ListingProviders/SchedulesDirect/Countries')).then(function (result: Record<string, CountryItem[]>) {
            let i: number;
            let length: number;
            const countryList: CountryItem[] = [];

            for (const region in result) {
                const countries = result[region];

                if (countries.length && region !== 'ZZZ') {
                    for (i = 0, length = countries.length; i < length; i++) {
                        countryList.push({
                            name: countries[i].fullName || '',
                            value: countries[i].shortName || ''
                        });
                    }
                }
            }

            countryList.sort(function (a, b) {
                if (a.name > b.name) {
                    return 1;
                }

                if (a.name < b.name) {
                    return -1;
                }

                return 0;
            });
            $('#selectCountry', page).html(countryList.map(function (c) {
                return '<option value="' + c.value + '">' + c.name + '</option>';
            }).join('')).val(info.Country || '');
            page.querySelector('.txtZipCode')?.dispatchEvent(new Event('change'));
        }, function () { // ApiClient.getJSON() error handler
            Dashboard.alert({
                message: globalize.translate('ErrorGettingTvLineups')
            });
        });
        loading.hide();
    }

    function submitLoginForm(): void {
        loading.show();
        const info: Record<string, unknown> = {
            Type: 'SchedulesDirect',
            Username: (page.querySelector('.txtUser') as HTMLInputElement).value,
            EnableAllTuners: true,
            Password: (page.querySelector('.txtPass') as HTMLInputElement).value
        };
        const id = providerId;

        if (id) {
            info.Id = id;
        }

        (window.ApiClient as any).ajax({
            type: 'POST',
            url: (window.ApiClient as any).getUrl('LiveTv/ListingProviders', {
                ValidateLogin: true
            }),
            data: JSON.stringify(info),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (result: { Id: string }) {
            Dashboard.processServerConfigurationUpdateResult();
            providerId = result.Id;
            reload();
        }, function () {
            Dashboard.alert({
                message: globalize.translate('ErrorSavingTvProvider')
            });
        });
    }

    function submitListingsForm(): void {
        const selectedListingsId = (page.querySelector('#selectListing') as HTMLSelectElement).value;

        if (!selectedListingsId) {
            Dashboard.alert({
                message: globalize.translate('ErrorPleaseSelectLineup')
            });
            return;
        }

        loading.show();
        const id = providerId;
        (window.ApiClient as any).getNamedConfiguration('livetv').then(function (config: LiveTvConfig) {
            const info = config.ListingProviders.filter(function (i) {
                return i.Id === id;
            })[0];
            info.ZipCode = (page.querySelector('.txtZipCode') as HTMLInputElement).value;
            info.Country = (page.querySelector('#selectCountry') as HTMLSelectElement).value;
            info.ListingsId = selectedListingsId;
            info.EnableAllTuners = (page.querySelector('.chkAllTuners') as HTMLInputElement).checked;
            info.EnabledTuners = info.EnableAllTuners ? [] : $('.chkTuner', page).get().filter(function (i: HTMLElement) {
                return (i as HTMLInputElement).checked;
            }).map(function (i: HTMLElement) {
                return (i as HTMLInputElement).getAttribute('data-id') || '';
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

                if (options.showConfirmation) {
                    Dashboard.processServerConfigurationUpdateResult();
                }

                Events.trigger(self as unknown as object, 'submitted');
            }, function () {
                loading.hide();
                Dashboard.alert({
                    message: globalize.translate('ErrorAddingListingsToSchedulesDirect')
                });
            });
        });
    }

    function refreshListings(value: string): void {
        if (!value) {
            page.querySelector('#selectListing')!.innerHTML = '';
            return;
        }

        loading.show();
        (window.ApiClient as any).ajax({
            type: 'GET',
            url: (window.ApiClient as any).getUrl('LiveTv/ListingProviders/Lineups', {
                Id: providerId,
                Location: value,
                Country: (page.querySelector('#selectCountry') as HTMLSelectElement).value
            }),
            dataType: 'json'
        }).then(function (result: Array<{ Id: string; Name: string }>) {
            page.querySelector('#selectListing')!.innerHTML = result.map(function (o) {
                return '<option value="' + o.Id + '">' + o.Name + '</option>';
            }).join('');

            if (listingsId) {
                (page.querySelector('#selectListing') as HTMLSelectElement).value = listingsId;
            }

            loading.hide();
        }, function () {
            Dashboard.alert({
                message: globalize.translate('ErrorGettingTvLineups')
            });
            refreshListings('');
            loading.hide();
        });
    }

    const self: Record<string, unknown> = this;

    self.submit = function (): void {
        (page.querySelector('.btnSubmitListingsContainer') as HTMLElement)?.click();
    };

    self.init = function (): void {
        options = options || {} as Options;

        // Only hide the buttons if explicitly set to false; default to showing if undefined or null
        // FIXME: rename this option to clarify logic
        const hideCancelButton = options.showCancelButton === false;
        page.querySelector('.btnCancel')?.classList.toggle('hide', hideCancelButton);

        const hideSubmitButton = options.showSubmitButton === false;
        page.querySelector('.btnSubmitListings')?.classList.toggle('hide', hideSubmitButton);

        page.querySelector('.formLogin')?.addEventListener('submit', function (e: Event) {
            e.preventDefault();
            submitLoginForm();
        });

        page.querySelector('.formListings')?.addEventListener('submit', function (e: Event) {
            e.preventDefault();
            submitListingsForm();
        });

        page.querySelector('.txtZipCode')?.addEventListener('change', function (this: HTMLInputElement) {
            refreshListings(this.value);
        });
        page.querySelector('.chkAllTuners')?.addEventListener('change', function (e: Event) {
            if ((e.target as HTMLInputElement).checked) {
                page.querySelector('.selectTunersSection')?.classList.add('hide');
            } else {
                page.querySelector('.selectTunersSection')?.classList.remove('hide');
            }
        });
        $('.createAccountHelp', page).html(globalize.translate('MessageCreateAccountAt', '<a is="emby-linkbutton" class="button-link" href="http://www.schedulesdirect.org" target="_blank">http://www.schedulesdirect.org</a>'));
        reload();
    };
}
