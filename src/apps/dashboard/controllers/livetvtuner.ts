import globalize from 'lib/globalize';
import loading from 'components/loading/loading';
import dom from 'utils/dom';
import 'elements/emby-input/emby-input';
import 'elements/emby-button/emby-button';
import 'elements/emby-checkbox/emby-checkbox';
import 'elements/emby-select/emby-select';
import Dashboard from 'utils/dashboard';
import { getParameterByName } from 'utils/url';

declare const ApiClient: {
    getJSON(url: string): Promise<Array<{ Id: string; Name: string }>>;
    getUrl(path: string): string;
    getNamedConfiguration(name: string): Promise<{ TunerHosts: TunerHostInfo[] }>;
    ajax(options: {
        type: string;
        url: string;
        data: string;
        contentType: string;
    }): Promise<void>;
    serverId(): string;
};

interface PageElements extends HTMLElement {
    querySelector<T extends Element>(selectors: string): T | null;
}

interface LabeledInputElement extends HTMLInputElement {
    label(text: string): void;
}

interface TunerHostInfo {
    Id?: string;
    Type?: string;
    Source?: string;
    Url?: string | null;
    FriendlyName?: string | null;
    UserAgent?: string | null;
    DeviceId?: string | null;
    TunerCount?: number | string | null;
    FallbackMaxStreamingBitrate?: number;
    ImportFavoritesOnly?: boolean;
    AllowHWTranscoding?: boolean;
    AllowFmp4TranscodingContainer?: boolean;
    AllowStreamSharing?: boolean;
    EnableStreamLooping?: boolean;
    IgnoreDts?: boolean;
    ReadAtNativeFramerate?: boolean;
}

interface TunerHostConfig {
    TunerHosts: TunerHostInfo[];
}

function isM3uVariant(type?: string): boolean {
    return ['nextpvr'].includes(type || '');
}

function fillTypes(view: PageElements, currentId?: string): Promise<void> {
    return ApiClient.getJSON(ApiClient.getUrl('LiveTv/TunerHosts/Types')).then((types) => {
        const selectType = view.querySelector<HTMLSelectElement>('.selectType');
        if (!selectType) {
            return;
        }

        let html = '';
        html += types.map((tuner) => {
            return '<option value="' + tuner.Id + '">' + tuner.Name + '</option>';
        }).join('');
        html += '<option value="other">';
        html += globalize.translate('TabOther');
        html += '</option>';
        selectType.innerHTML = html;
        selectType.disabled = currentId != null;
        selectType.value = '';
        onTypeChange.call(selectType);
    });
}

function reload(view: PageElements, providerId?: string): void {
    const devicePath = view.querySelector<HTMLInputElement>('.txtDevicePath');
    const favorite = view.querySelector<HTMLInputElement>('.chkFavorite');
    if (devicePath) {
        devicePath.value = '';
    }
    if (favorite) {
        favorite.checked = false;
    }
    if (devicePath) {
        devicePath.value = '';
    }

    if (providerId) {
        ApiClient.getNamedConfiguration('livetv').then((config: TunerHostConfig) => {
            const info = config.TunerHosts.filter((item) => {
                return item.Id === providerId;
            })[0];
            if (info) {
                fillTunerHostInfo(view, info);
            }
        });
    }
}

function fillTunerHostInfo(view: PageElements, info: TunerHostInfo): void {
    const selectType = view.querySelector<HTMLSelectElement>('.selectType');
    let type = info.Type || '';

    if (info.Source && isM3uVariant(info.Source)) {
        type = info.Source;
    }

    if (selectType) {
        selectType.value = type;
        onTypeChange.call(selectType);
    }

    (view.querySelector('.txtDevicePath') as HTMLInputElement).value = info.Url || '';
    (view.querySelector('.txtFriendlyName') as HTMLInputElement).value = info.FriendlyName || '';
    (view.querySelector('.txtUserAgent') as HTMLInputElement).value = info.UserAgent || '';
    (view.querySelector('.fldDeviceId') as HTMLInputElement).value = info.DeviceId || '';
    (view.querySelector('.chkFavorite') as HTMLInputElement).checked = !!info.ImportFavoritesOnly;
    (view.querySelector('.chkTranscode') as HTMLInputElement).checked = !!info.AllowHWTranscoding;
    (view.querySelector('.chkStreamLoop') as HTMLInputElement).checked = !!info.EnableStreamLooping;
    (view.querySelector('.chkFmp4Container') as HTMLInputElement).checked = !!info.AllowFmp4TranscodingContainer;
    (view.querySelector('.chkStreamSharing') as HTMLInputElement).checked = !!info.AllowStreamSharing;
    (view.querySelector('.chkIgnoreDts') as HTMLInputElement).checked = !!info.IgnoreDts;
    (view.querySelector('.chkReadInputAtNativeFramerate') as HTMLInputElement).checked = !!info.ReadAtNativeFramerate;
    (view.querySelector('.txtFallbackMaxStreamingBitrate') as HTMLInputElement).value = String(info.FallbackMaxStreamingBitrate ? info.FallbackMaxStreamingBitrate / 1e6 : '30');
    (view.querySelector('.txtTunerCount') as HTMLInputElement).value = String(info.TunerCount || '0');
}

function submitForm(page: PageElements): void {
    loading.show();

    const type = (page.querySelector('.selectType') as HTMLSelectElement).value;
    const info: TunerHostInfo & { Id?: string; Source?: string } = {
        Type: type,
        Url: (page.querySelector('.txtDevicePath') as HTMLInputElement).value || null,
        UserAgent: (page.querySelector('.txtUserAgent') as HTMLInputElement).value || null,
        FriendlyName: (page.querySelector('.txtFriendlyName') as HTMLInputElement).value || null,
        DeviceId: (page.querySelector('.fldDeviceId') as HTMLInputElement).value || null,
        TunerCount: (page.querySelector('.txtTunerCount') as HTMLInputElement).value || 0,
        FallbackMaxStreamingBitrate: parseInt(String(1e6 * parseFloat((page.querySelector('.txtFallbackMaxStreamingBitrate') as HTMLInputElement).value || '30')), 10),
        ImportFavoritesOnly: (page.querySelector('.chkFavorite') as HTMLInputElement).checked,
        AllowHWTranscoding: (page.querySelector('.chkTranscode') as HTMLInputElement).checked,
        AllowFmp4TranscodingContainer: (page.querySelector('.chkFmp4Container') as HTMLInputElement).checked,
        AllowStreamSharing: (page.querySelector('.chkStreamSharing') as HTMLInputElement).checked,
        EnableStreamLooping: (page.querySelector('.chkStreamLoop') as HTMLInputElement).checked,
        IgnoreDts: (page.querySelector('.chkIgnoreDts') as HTMLInputElement).checked,
        ReadAtNativeFramerate: (page.querySelector('.chkReadInputAtNativeFramerate') as HTMLInputElement).checked
    };

    if (isM3uVariant(info.Type)) {
        info.Source = info.Type;
        info.Type = 'm3u';
    }

    const id = getParameterByName('id');
    if (id) {
        info.Id = id;
    }

    ApiClient.ajax({
        type: 'POST',
        url: ApiClient.getUrl('LiveTv/TunerHosts'),
        data: JSON.stringify(info),
        contentType: 'application/json'
    }).then(() => {
        Dashboard.processServerConfigurationUpdateResult();
        Dashboard.navigate('dashboard/livetv');
    }, () => {
        loading.hide();
        Dashboard.alert({
            message: globalize.translate('ErrorSavingTvProvider')
        });
    });
}

function getDetectedDevice(): Promise<TunerHostInfo> {
    return import('components/tunerPicker').then(({ default: TunerPicker }) => {
        return new TunerPicker().show();
    });
}

function onTypeChange(this: HTMLSelectElement): void {
    const value = this.value;
    const view = dom.parentWithClass(this, 'page') as PageElements;
    const mayIncludeUnsupportedDrmChannels = value === 'hdhomerun';
    const supportsTranscoding = value === 'hdhomerun';
    const supportsFavorites = value === 'hdhomerun';
    const supportsTunerIpAddress = value === 'hdhomerun';
    const supportsTunerFileOrUrl = value === 'm3u';
    const supportsStreamLooping = value === 'm3u';
    const supportsIgnoreDts = value === 'm3u';
    const supportsReadInputAtNativeFramerate = value === 'm3u';
    const supportsTunerCount = value === 'm3u';
    const supportsUserAgent = value === 'm3u';
    const supportsFmp4Container = value === 'm3u';
    const supportsStreamSharing = value === 'm3u';
    const supportsFallbackBitrate = value === 'm3u' || value === 'hdhomerun';
    const suppportsSubmit = value !== 'other';
    const supportsSelectablePath = supportsTunerFileOrUrl;
    const txtDevicePath = view.querySelector('.txtDevicePath') as LabeledInputElement;

    if (supportsTunerIpAddress) {
        txtDevicePath.label(globalize.translate('LabelTunerIpAddress'));
        view.querySelector('.fldPath')?.classList.remove('hide');
    } else if (supportsTunerFileOrUrl) {
        txtDevicePath.label(globalize.translate('LabelFileOrUrl'));
        view.querySelector('.fldPath')?.classList.remove('hide');
    } else {
        view.querySelector('.fldPath')?.classList.add('hide');
    }

    if (supportsSelectablePath) {
        view.querySelector('.btnSelectPath')?.classList.remove('hide');
        txtDevicePath.setAttribute('required', 'required');
    } else {
        view.querySelector('.btnSelectPath')?.classList.add('hide');
        txtDevicePath.removeAttribute('required');
    }

    if (supportsUserAgent) {
        view.querySelector('.fldUserAgent')?.classList.remove('hide');
    } else {
        view.querySelector('.fldUserAgent')?.classList.add('hide');
    }

    if (supportsFavorites) {
        view.querySelector('.fldFavorites')?.classList.remove('hide');
    } else {
        view.querySelector('.fldFavorites')?.classList.add('hide');
    }

    if (supportsTranscoding) {
        view.querySelector('.fldTranscode')?.classList.remove('hide');
    } else {
        view.querySelector('.fldTranscode')?.classList.add('hide');
    }

    view.querySelector('.fldFmp4Container')?.classList.toggle('hide', !supportsFmp4Container);
    view.querySelector('.fldStreamSharing')?.classList.toggle('hide', !supportsStreamSharing);
    view.querySelector('.fldFallbackMaxStreamingBitrate')?.classList.toggle('hide', !supportsFallbackBitrate);

    if (supportsStreamLooping) {
        view.querySelector('.fldStreamLoop')?.classList.remove('hide');
    } else {
        view.querySelector('.fldStreamLoop')?.classList.add('hide');
    }

    if (supportsIgnoreDts) {
        view.querySelector('.fldIgnoreDts')?.classList.remove('hide');
    } else {
        view.querySelector('.fldIgnoreDts')?.classList.add('hide');
    }

    view.querySelector('.fldReadInputAtNativeFramerate')?.classList.toggle('hide', !supportsReadInputAtNativeFramerate);

    if (supportsTunerCount) {
        view.querySelector('.fldTunerCount')?.classList.remove('hide');
        (view.querySelector('.txtTunerCount') as HTMLInputElement)?.setAttribute('required', 'required');
    } else {
        view.querySelector('.fldTunerCount')?.classList.add('hide');
        (view.querySelector('.txtTunerCount') as HTMLInputElement)?.removeAttribute('required');
    }

    if (mayIncludeUnsupportedDrmChannels) {
        view.querySelector('.drmMessage')?.classList.remove('hide');
    } else {
        view.querySelector('.drmMessage')?.classList.add('hide');
    }

    if (suppportsSubmit) {
        view.querySelector('.button-submit')?.classList.remove('hide');
    } else {
        view.querySelector('.button-submit')?.classList.add('hide');
    }
}

export default function (view: PageElements, params: { id?: string }): void {
    if (!params.id) {
        view.querySelector('.btnDetect')?.classList.remove('hide');
    }

    view.addEventListener('viewshow', () => {
        const currentId = params.id;
        fillTypes(view, currentId).then(() => {
            reload(view, currentId);
        });
    });
    (view.querySelector('form') as HTMLFormElement)?.addEventListener('submit', (e) => {
        submitForm(view);
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
    (view.querySelector('.selectType') as HTMLSelectElement)?.addEventListener('change', onTypeChange);
    (view.querySelector('.btnDetect') as HTMLElement)?.addEventListener('click', () => {
        getDetectedDevice().then((info) => {
            fillTunerHostInfo(view, info);
        });
    });
    (view.querySelector('.btnSelectPath') as HTMLElement)?.addEventListener('click', () => {
        import('components/directorybrowser/directorybrowser').then(({ default: DirectoryBrowser }) => {
            const picker = new DirectoryBrowser();
            picker.show({
                includeFiles: true,
                callback: (path: string) => {
                    if (path) {
                        (view.querySelector('.txtDevicePath') as HTMLInputElement).value = path;
                    }

                    picker.close();
                }
            });
        });
    });
}
