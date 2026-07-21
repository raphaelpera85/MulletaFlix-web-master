import appSettings from '../scripts/settings/appSettings';
import browser from '../scripts/browser';
import Events from '../utils/events';
import * as htmlMediaHelper from '../components/htmlMediaHelper';
import * as webSettings from '../scripts/settings/webSettings';
import globalize from '../lib/globalize';
import profileBuilder from '../scripts/browserDeviceProfile';
import { AppFeature } from 'constants/appFeature';
import { LayoutMode } from 'constants/layoutMode';

const appName = 'MulletaFlix Web';

const BrowserName: Record<string, string> = {
    tizen: 'Samsung Smart TV',
    web0s: 'LG Smart TV',
    titanos: 'Titan OS',
    vega: 'Vega OS',
    operaTv: 'Opera TV',
    xboxOne: 'Xbox One',
    ps4: 'Sony PS4',
    chrome: 'Chrome',
    edgeChromium: 'Edge Chromium',
    edge: 'Edge',
    firefox: 'Firefox',
    opera: 'Opera',
    safari: 'Safari'
};

interface BaseProfileOptions {
    enableMkvProgressive: boolean;
    disableHlsVideoAudioCodecs: string[];
}

function getBaseProfileOptions(item: any): BaseProfileOptions {
    const disableHlsVideoAudioCodecs: string[] = [];

    if (item && htmlMediaHelper.enableHlsJsPlayer(item.RunTimeTicks, item.MediaType)) {
        if (browser.edge) {
            disableHlsVideoAudioCodecs.push('mp3');
        }
        if (!browser.edgeChromium) {
            disableHlsVideoAudioCodecs.push('ac3');
            disableHlsVideoAudioCodecs.push('eac3');
        }
        if (!(browser.chrome || browser.edgeChromium || browser.firefox)) {
            disableHlsVideoAudioCodecs.push('opus');
        }
    }

    return {
        enableMkvProgressive: false,
        disableHlsVideoAudioCodecs: disableHlsVideoAudioCodecs
    };
}

function getDeviceProfile(item: any): Promise<any> {
    return new Promise(function (resolve) {
        let profile: any;

        if (window.NativeShell) {
            profile = window.NativeShell.AppHost.getDeviceProfile(profileBuilder, __PACKAGE_JSON_VERSION__);
        } else {
            const builderOpts = getBaseProfileOptions(item);
            profile = profileBuilder(builderOpts);
        }

        const maxVideoWidth = appSettings.maxVideoWidth();
        const maxTranscodingVideoWidth = maxVideoWidth < 0 ? appHost.screen()?.maxAllowedWidth : maxVideoWidth;

        if (maxTranscodingVideoWidth) {
            const conditionWidth = {
                Condition: 'LessThanEqual',
                Property: 'Width',
                Value: maxTranscodingVideoWidth.toString(),
                IsRequired: false
            };

            if (appSettings.limitSupportedVideoResolution()) {
                profile.CodecProfiles.push({
                    Type: 'Video',
                    Conditions: [conditionWidth]
                });
            }

            profile.TranscodingProfiles.forEach((transcodingProfile: any) => {
                if (transcodingProfile.Type === 'Video') {
                    transcodingProfile.Conditions = (transcodingProfile.Conditions || []).filter((condition: any) => {
                        return condition.Property !== 'Width';
                    });

                    transcodingProfile.Conditions.push(conditionWidth);
                }
            });
        }

        const preferredTranscodeVideoCodec = appSettings.preferredTranscodeVideoCodec();
        if (preferredTranscodeVideoCodec) {
            profile.TranscodingProfiles.forEach((transcodingProfile: any) => {
                if (transcodingProfile.Type === 'Video') {
                    const videoCodecs = transcodingProfile.VideoCodec.split(',');
                    const index = videoCodecs.indexOf(preferredTranscodeVideoCodec);
                    if (index !== -1) {
                        videoCodecs.splice(index, 1);
                        videoCodecs.unshift(preferredTranscodeVideoCodec);
                        transcodingProfile.VideoCodec = videoCodecs.join(',');
                    }
                }
            });
        }

        const preferredTranscodeVideoAudioCodec = appSettings.preferredTranscodeVideoAudioCodec();
        if (preferredTranscodeVideoAudioCodec) {
            profile.TranscodingProfiles.forEach((transcodingProfile: any) => {
                if (transcodingProfile.Type === 'Video') {
                    const audioCodecs = transcodingProfile.AudioCodec.split(',');
                    const index = audioCodecs.indexOf(preferredTranscodeVideoAudioCodec);
                    if (index !== -1) {
                        audioCodecs.splice(index, 1);
                        audioCodecs.unshift(preferredTranscodeVideoAudioCodec);
                        transcodingProfile.AudioCodec = audioCodecs.join(',');
                    }
                }
            });
        }

        resolve(profile);
    });
}

function generateDeviceId(): string | number {
    const keys: (string | number)[] = [];

    keys.push(navigator.userAgent);
    keys.push(new Date().getTime());
    if ((window as any).btoa) {
        return btoa(keys.join('|')).replace(/=/g, '1');
    }

    return new Date().getTime();
}

let deviceId: string | number | null = null;
function getDeviceId(): string | number {
    if (!deviceId) {
        const key = '_deviceId2';

        deviceId = appSettings.get(key) as string | number | null;

        if (!deviceId) {
            deviceId = generateDeviceId();
            appSettings.set(key, String(deviceId));
        }
    }

    return deviceId;
}

let deviceName: string | undefined;
function getDeviceName(): string {
    if (deviceName) {
        return deviceName;
    }

    deviceName = 'Web Browser'; // Default device name

    for (const key in BrowserName) {
        if ((browser as any)[key]) {
            deviceName = BrowserName[key];
            break;
        }
    }

    if (browser.ipad) {
        deviceName += ' iPad';
    } else if (browser.iphone) {
        deviceName += ' iPhone';
    } else if (browser.android) {
        deviceName += ' Android';
    }
    return deviceName;
}

function supportsFullscreen(): boolean {
    if (browser.tv) {
        return false;
    }

    const element = document.documentElement;
    return !!(element.requestFullscreen || (element as any).mozRequestFullScreen || (element as any).webkitRequestFullscreen || (element as any).msRequestFullscreen || (document.createElement('video') as any).webkitEnterFullscreen);
}

function getDefaultLayout(): string {
    return LayoutMode.Experimental;
}

function supportsHtmlMediaAutoplay(): boolean {
    if (browser.edgeUwp || browser.tizen || browser.web0s || browser.orsay || browser.operaTv || browser.ps4 || browser.xboxOne) {
        return true;
    }

    return !browser.mobile;
}

function supportsCue(): boolean {
    try {
        const video = document.createElement('video');
        const style = document.createElement('style');

        style.textContent = 'video::cue {background: inherit}';
        document.body.appendChild(style);
        document.body.appendChild(video);

        const cue = window.getComputedStyle(video, '::cue').background;
        document.body.removeChild(style);
        document.body.removeChild(video);

        return !!cue.length;
    } catch (err) {
        console.error('error detecting cue support: ' + err);
        return false;
    }
}

let isHidden = false;
function onAppVisible(): void {
    if (isHidden) {
        isHidden = false;
        Events.trigger(appHost, 'resume');
    }
}

function onAppHidden(): void {
    if (!isHidden) {
        isHidden = true;
    }
}

const supportedFeatures: string[] = (function () {
    const features: string[] = [];

    if ((navigator as any).share) {
        features.push(AppFeature.Sharing);
    }

    if (!browser.edgeUwp && !browser.tv && !browser.xboxOne && !browser.ps4) {
        features.push(AppFeature.FileDownload);
    }

    if (browser.operaTv || browser.tizen || browser.orsay || browser.web0s) {
        features.push(AppFeature.Exit);
    }

    if (!browser.operaTv && !browser.tizen && !browser.orsay && !browser.web0s && !browser.ps4) {
        features.push(AppFeature.ExternalLinks);
    }

    if (supportsHtmlMediaAutoplay()) {
        features.push(AppFeature.HtmlAudioAutoplay);
        features.push(AppFeature.HtmlVideoAutoplay);
    }

    if (supportsFullscreen()) {
        features.push(AppFeature.Fullscreen);
    }

    if (browser.tv || browser.xboxOne || browser.ps4 || browser.mobile || browser.ipad) {
        features.push(AppFeature.PhysicalVolumeControl);
    }

    if (!browser.tv && !browser.xboxOne && !browser.ps4) {
        features.push(AppFeature.RemoteControl);
    }

    if (!browser.operaTv && !browser.tizen && !browser.orsay && !browser.web0s && !browser.edgeUwp) {
        features.push(AppFeature.RemoteVideo);
    }

    features.push(AppFeature.DisplayLanguage);
    features.push(AppFeature.DisplayMode);
    features.push(AppFeature.TargetBlank);
    features.push(AppFeature.Screensaver);

    webSettings.getMultiServer().then((enabled: boolean) => {
        if (enabled) features.push(AppFeature.MultiServer);
    });

    if (!browser.orsay && (browser.firefox || browser.ps4 || browser.edge || supportsCue())) {
        features.push(AppFeature.SubtitleAppearance);
    }

    if (!browser.orsay) {
        features.push(AppFeature.SubtitleBurnIn);
    }

    if (!browser.tv && !browser.ps4 && !browser.xboxOne) {
        features.push(AppFeature.FileInput);
    }

    if (browser.chrome || browser.edgeChromium) {
        features.push(AppFeature.Chromecast);
    }

    return features;
}());

/**
     * Do exit according to platform
     */
function doExit(): void {
    try {
        if (window.NativeShell?.AppHost?.exit) {
            window.NativeShell.AppHost.exit();
        } else if (browser.tizen) {
            (window as any).tizen.application.getCurrentApplication().exit();
        } else if (browser.web0s) {
            (window as any).webOS.platformBack();
        } else {
            window.close();
        }
    } catch (err) {
        console.error('error closing application: ' + err);
    }
}

let exitPromise: Promise<unknown> | null;

/**
     * Ask user for exit
     */
function askForExit(): void {
    if (exitPromise) {
        return;
    }

    import('../components/actionSheet/actionSheet').then((actionsheet) => {
        exitPromise = actionsheet.show({
            title: globalize.translate('MessageConfirmAppExit'),
            items: [
                { id: 'yes', name: globalize.translate('Yes') },
                { id: 'no', name: globalize.translate('No') }
            ]
        }).then(function (value: unknown) {
            if (value === 'yes') {
                doExit();
            }
        }).finally(function () {
            exitPromise = null;
        });
    });
}

interface HostScreen {
    width: number;
    height: number;
    maxAllowedWidth?: number;
}

export const appHost = {
    getWindowState: function (): string {
        return (document as any).windowState || 'Normal';
    },
    setWindowState: function (): void {
        alert('setWindowState is not supported and should not be called');
    },
    exit: function (): void {
        if (!!(window as any).appMode && browser.tizen) {
            askForExit();
        } else {
            doExit();
        }
    },
    supports: function (command: string): boolean {
        if (window.NativeShell) {
            return window.NativeShell.AppHost.supports(command);
        }

        return supportedFeatures.indexOf(command.toLowerCase()) !== -1;
    },
    preferVisualCards: browser.android || browser.chrome,
    getDefaultLayout: function (): string {
        if (window.NativeShell) {
            return window.NativeShell.AppHost.getDefaultLayout();
        }

        return getDefaultLayout();
    },
    getDeviceProfile,
    init: function (): any {
        if (window.NativeShell) {
            return window.NativeShell.AppHost.init();
        }

        return {
            deviceId: getDeviceId(),
            deviceName: getDeviceName()
        };
    },
    deviceName: function (): string {
        return window.NativeShell?.AppHost?.deviceName ?
            window.NativeShell.AppHost.deviceName() : getDeviceName();
    },
    deviceId: function (): string {
        return window.NativeShell?.AppHost?.deviceId ?
            window.NativeShell.AppHost.deviceId() : String(getDeviceId());
    },
    appName: function (): string {
        return window.NativeShell?.AppHost?.appName ?
            window.NativeShell.AppHost.appName() : appName;
    },
    appVersion: function (): string {
        return window.NativeShell?.AppHost?.appVersion ?
            window.NativeShell.AppHost.appVersion() : __PACKAGE_JSON_VERSION__;
    },
    getPushTokenInfo: function (): Record<string, never> {
        return {};
    },
    setUserScalable: function (scalable: boolean): void {
        if (!browser.tv) {
            const att = scalable ? 'width=device-width, initial-scale=1, minimum-scale=1, user-scalable=yes' : 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no';
            document.querySelector('meta[name=viewport]')!.setAttribute('content', att);
        }
    },
    screen: (): HostScreen | null => {
        let hostScreen: HostScreen | null = null;

        const appHostImpl = window.NativeShell?.AppHost;

        if (appHostImpl?.screen) {
            hostScreen = appHostImpl.screen();
        } else if (window.screen && !browser.tv) {
            hostScreen = {
                width: Math.floor(window.screen.width * window.devicePixelRatio),
                height: Math.floor(window.screen.height * window.devicePixelRatio)
            };
        }

        if (hostScreen) {
            // Use larger dimension to account for screen orientation changes
            hostScreen.maxAllowedWidth = Math.max(hostScreen.width, hostScreen.height);
        }

        return hostScreen;
    }
};

let hidden: string | undefined;
let visibilityChange: string | undefined;

if (typeof document.hidden !== 'undefined') {
    hidden = 'hidden';
    visibilityChange = 'visibilitychange';
} else if (typeof (document as any).webkitHidden !== 'undefined') {
    hidden = 'webkitHidden';
    visibilityChange = 'webkitvisibilitychange';
}

document.addEventListener(visibilityChange!, function () {
    if ((document as any)[hidden!]) {
        onAppHidden();
    } else {
        onAppVisible();
    }
}, false);

if (window.addEventListener) {
    window.addEventListener('focus', onAppVisible);
    window.addEventListener('blur', onAppHidden);
}
