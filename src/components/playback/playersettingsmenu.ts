import actionsheet from '../actionSheet/actionSheet';
import { playbackManager } from '../playback/playbackmanager';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import qualityoptions from '../qualityOptions';

interface PlaybackStream {
    Type?: string;
    Codec?: string;
    BitRate?: number;
    Width?: number;
    Height?: number;
}

interface PlaybackSource {
    MediaStreams: PlaybackStream[];
    RunTimeTicks?: number;
}

interface PlaybackItem {
    ServerId?: string;
}

interface PlaybackUser {
    Policy?: {
        EnableVideoPlaybackTranscoding?: boolean;
    };
}

interface PlayerSettingsPlayerContract {
    currentMediaSource(): PlaybackSource;
    getMaxStreamingBitrate(): number;
    enableAutomaticBitrateDetection(): boolean;
    setMaxStreamingBitrate(options: { enableAutomaticBitrateDetection: boolean; maxBitrate: number }, player: PlayerSettingsPlayerContract): void;
    getRepeatMode(): string;
    setRepeatMode(mode: string, player: PlayerSettingsPlayerContract): void;
    getAspectRatio(): string;
    getSupportedAspectRatios(): Array<{ id: string; name: string }>;
    setAspectRatio(id: string, player: PlayerSettingsPlayerContract): void;
    getPlaybackRate(): number;
    getSupportedPlaybackRates(): Array<{ id: number; name: string }>;
    setPlaybackRate(id: number, player: PlayerSettingsPlayerContract): void;
    getSupportedCommands(): string[];
    currentItem(): PlaybackItem | null;
    getPlayerState(): { PlayState?: { PlayMethod?: string } };
}

interface PlayerSettingsOptions {
    player: PlayerSettingsPlayerContract;
    quality?: boolean;
    suboffset?: boolean;
    stats?: boolean;
    positionTo: HTMLElement;
    onOption?: (id: string) => void;
}

interface PlayerSettingsMenuItem {
    name: string;
    id: string;
    asideText?: string;
    selected?: boolean;
}

interface PlaybackManagerContract {
    currentMediaSource(player: PlayerSettingsPlayerContract): PlaybackSource;
    getMaxStreamingBitrate(player: PlayerSettingsPlayerContract): number;
    enableAutomaticBitrateDetection(player: PlayerSettingsPlayerContract): boolean;
    setMaxStreamingBitrate(options: { enableAutomaticBitrateDetection: boolean; maxBitrate: number }, player: PlayerSettingsPlayerContract): void;
    getRepeatMode(player: PlayerSettingsPlayerContract): string;
    setRepeatMode(mode: string, player: PlayerSettingsPlayerContract): void;
    getAspectRatio(player: PlayerSettingsPlayerContract): string;
    getSupportedAspectRatios(player: PlayerSettingsPlayerContract): Array<{ id: string; name: string }>;
    setAspectRatio(id: string, player: PlayerSettingsPlayerContract): void;
    getPlaybackRate(player: PlayerSettingsPlayerContract): number;
    getSupportedPlaybackRates(player: PlayerSettingsPlayerContract): Array<{ id: number; name: string }>;
    setPlaybackRate(id: number, player: PlayerSettingsPlayerContract): void;
    getSupportedCommands(player: PlayerSettingsPlayerContract): string[];
    currentItem(player: PlayerSettingsPlayerContract): PlaybackItem | null;
    getPlayerState(player: PlayerSettingsPlayerContract): { PlayState?: { PlayMethod?: string } };
}

function showQualityMenu(player: PlayerSettingsPlayerContract, btn: HTMLElement): Promise<void> {
    const mediaSource = (playbackManager as unknown as PlaybackManagerContract).currentMediaSource(player);
    const videoStream = mediaSource.MediaStreams.filter(function (stream) {
        return stream.Type === 'Video';
    })[0];

    const videoCodec = videoStream ? videoStream.Codec : null;
    const videoBitRate = videoStream ? videoStream.BitRate : null;

    const options = qualityoptions.getVideoQualityOptions({
        currentMaxBitrate: (playbackManager as unknown as PlaybackManagerContract).getMaxStreamingBitrate(player),
        isAutomaticBitrateEnabled: (playbackManager as unknown as PlaybackManagerContract).enableAutomaticBitrateDetection(player),
        videoCodec: videoCodec || undefined,
        videoBitRate: videoBitRate || undefined,
        enableAuto: true
    });

    const menuItems = options.map(function (o) {
        const opt: PlayerSettingsMenuItem = {
            name: o.name,
            id: String(o.bitrate),
            asideText: o.autoText
        };

        if (o.selected) {
            opt.selected = true;
        }

        return opt;
    });

    const selectedId = options.filter(function (o) {
        return o.selected;
    });

    const selectedBitrate = selectedId.length ? selectedId[0].bitrate : null;

    return actionsheet.show({
        items: menuItems,
        positionTo: btn
    }).then(function (id) {
        const bitrate = parseInt(String(id), 10);
        if (bitrate !== selectedBitrate) {
            (playbackManager as unknown as PlaybackManagerContract).setMaxStreamingBitrate({
                enableAutomaticBitrateDetection: !bitrate,
                maxBitrate: bitrate
            }, player);
        }
    });
}

function showRepeatModeMenu(player: PlayerSettingsPlayerContract, btn: HTMLElement): Promise<void> {
    const menuItems: PlayerSettingsMenuItem[] = [];
    const currentValue = (playbackManager as unknown as PlaybackManagerContract).getRepeatMode(player);

    menuItems.push({
        name: globalize.translate('RepeatAll'),
        id: 'RepeatAll',
        selected: currentValue === 'RepeatAll'
    });

    menuItems.push({
        name: globalize.translate('RepeatOne'),
        id: 'RepeatOne',
        selected: currentValue === 'RepeatOne'
    });

    menuItems.push({
        name: globalize.translate('None'),
        id: 'RepeatNone',
        selected: currentValue === 'RepeatNone'
    });

    return actionsheet.show({
        items: menuItems,
        positionTo: btn
    }).then(function (mode) {
        if (mode) {
            (playbackManager as unknown as PlaybackManagerContract).setRepeatMode(String(mode), player);
        }
    });
}

function getQualitySecondaryText(player: PlayerSettingsPlayerContract): string | null {
    const state = (playbackManager as unknown as PlaybackManagerContract).getPlayerState(player);
    const mediaSource = (playbackManager as unknown as PlaybackManagerContract).currentMediaSource(player);
    const videoStream = mediaSource.MediaStreams.filter(function (stream) {
        return stream.Type === 'Video';
    })[0];

    const videoCodec = videoStream ? videoStream.Codec : null;
    const videoBitRate = videoStream ? videoStream.BitRate : null;
    const videoWidth = videoStream ? videoStream.Width : null;
    const videoHeight = videoStream ? videoStream.Height : null;

    const options = qualityoptions.getVideoQualityOptions({
        currentMaxBitrate: (playbackManager as unknown as PlaybackManagerContract).getMaxStreamingBitrate(player),
        isAutomaticBitrateEnabled: (playbackManager as unknown as PlaybackManagerContract).enableAutomaticBitrateDetection(player),
        videoCodec: videoCodec || undefined,
        videoBitRate: videoBitRate || undefined,
        enableAuto: true
    });

    const selectedOption = options.filter(function (o) {
        return o.selected;
    });

    if (!selectedOption.length) {
        return null;
    }

    const currentQualityOption = selectedOption[0];
    let text = currentQualityOption.name;

    if (currentQualityOption.autoText) {
        if (state.PlayState && state.PlayState.PlayMethod !== 'Transcode') {
            text += ' - Direct';
        } else {
            text += ' ' + currentQualityOption.autoText;
        }
    }

    return text;
}

function showAspectRatioMenu(player: PlayerSettingsPlayerContract, btn: HTMLElement): Promise<void> {
    const currentId = (playbackManager as unknown as PlaybackManagerContract).getAspectRatio(player);
    const menuItems = (playbackManager as unknown as PlaybackManagerContract).getSupportedAspectRatios(player)
        .map(({ id, name }) => ({
            id,
            name,
            selected: id === currentId
        }));

    return actionsheet.show({
        items: menuItems,
        positionTo: btn
    }).then(function (id) {
        if (id) {
            (playbackManager as unknown as PlaybackManagerContract).setAspectRatio(String(id), player);
            return Promise.resolve();
        }

        return Promise.reject();
    });
}

function showPlaybackRateMenu(player: PlayerSettingsPlayerContract, btn: HTMLElement): Promise<void> {
    const currentId = (playbackManager as unknown as PlaybackManagerContract).getPlaybackRate(player);
    const menuItems = (playbackManager as unknown as PlaybackManagerContract).getSupportedPlaybackRates(player).map(i => ({
        id: String(i.id),
        name: i.name,
        selected: i.id === currentId
    }));

    return actionsheet.show({
        items: menuItems,
        positionTo: btn
    }).then(function (id) {
        if (id) {
            (playbackManager as unknown as PlaybackManagerContract).setPlaybackRate(Number(id), player);
            return Promise.resolve();
        }

        return Promise.reject();
    });
}

function showWithUser(options: PlayerSettingsOptions, player: PlayerSettingsPlayerContract, user: PlaybackUser | null): Promise<void> {
    const supportedCommands = (playbackManager as unknown as PlaybackManagerContract).getSupportedCommands(player);

    const menuItems: PlayerSettingsMenuItem[] = [];
    if (supportedCommands.indexOf('SetAspectRatio') !== -1) {
        const currentAspectRatioId = (playbackManager as unknown as PlaybackManagerContract).getAspectRatio(player);
        const currentAspectRatio = (playbackManager as unknown as PlaybackManagerContract).getSupportedAspectRatios(player).filter(function (i) {
            return i.id === currentAspectRatioId;
        })[0];

        menuItems.push({
            name: globalize.translate('AspectRatio'),
            id: 'aspectratio',
            asideText: currentAspectRatio ? currentAspectRatio.name : undefined
        });
    }

    if (supportedCommands.indexOf('PlaybackRate') !== -1) {
        const currentPlaybackRateId = (playbackManager as unknown as PlaybackManagerContract).getPlaybackRate(player);
        const currentPlaybackRate = (playbackManager as unknown as PlaybackManagerContract).getSupportedPlaybackRates(player).filter(i => i.id === currentPlaybackRateId)[0];

        menuItems.push({
            name: globalize.translate('PlaybackRate'),
            id: 'playbackrate',
            asideText: currentPlaybackRate ? currentPlaybackRate.name : undefined
        });
    }

    if (options.quality && supportedCommands.includes('SetMaxStreamingBitrate')
            && user?.Policy?.EnableVideoPlaybackTranscoding) {
        const secondaryQualityText = getQualitySecondaryText(player);

        menuItems.push({
            name: globalize.translate('Quality'),
            id: 'quality',
            asideText: secondaryQualityText || undefined
        });
    }

    const repeatMode = (playbackManager as unknown as PlaybackManagerContract).getRepeatMode(player);

    if (supportedCommands.indexOf('SetRepeatMode') !== -1 && (playbackManager as unknown as PlaybackManagerContract).currentMediaSource(player).RunTimeTicks) {
        menuItems.push({
            name: globalize.translate('RepeatMode'),
            id: 'repeatmode',
            asideText: repeatMode === 'RepeatNone' ? globalize.translate('None') : globalize.translate('' + repeatMode)
        });
    }

    if (options.suboffset) {
        menuItems.push({
            name: globalize.translate('SubtitleOffset'),
            id: 'suboffset',
            asideText: undefined
        });
    }

    if (options.stats) {
        menuItems.push({
            name: globalize.translate('PlaybackData'),
            id: 'stats',
            asideText: undefined
        });
    }

    return actionsheet.show({
        items: menuItems,
        positionTo: options.positionTo
    }).then(function (id) {
        return handleSelectedOption(String(id), options, player);
    });
}

export function show(options: PlayerSettingsOptions): Promise<void> {
    const player = options.player;
    const currentItem = (playbackManager as unknown as PlaybackManagerContract).currentItem(player);

    if (!currentItem?.ServerId) {
        return showWithUser(options, player, null);
    }

    const apiClient = ServerConnections.getApiClient(currentItem.ServerId);
    return apiClient.getCurrentUser().then(function (user) {
        return showWithUser(options, player, user as PlaybackUser);
    });
}

function handleSelectedOption(id: string, options: PlayerSettingsOptions, player: PlayerSettingsPlayerContract): Promise<void> {
    switch (id) {
        case 'quality':
            return showQualityMenu(player, options.positionTo);
        case 'aspectratio':
            return showAspectRatioMenu(player, options.positionTo);
        case 'playbackrate':
            return showPlaybackRateMenu(player, options.positionTo);
        case 'repeatmode':
            return showRepeatModeMenu(player, options.positionTo);
        case 'stats':
            if (options.onOption) {
                options.onOption('stats');
            }
            return Promise.resolve();
        case 'suboffset':
            if (options.onOption) {
                options.onOption('suboffset');
            }
            return Promise.resolve();
        default:
            break;
    }

    return Promise.reject();
}

export default {
    show: show
};
