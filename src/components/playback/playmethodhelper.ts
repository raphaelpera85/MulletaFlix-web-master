import type { SessionInfo } from '@jellyfin/sdk/lib/generated-client/models/session-info';

type DisplayPlayMethod = 'Remux' | 'DirectStream' | 'Transcode' | 'DirectPlay' | null;

export function getDisplayPlayMethod(session: SessionInfo): DisplayPlayMethod {
    if (!session.NowPlayingItem) {
        return null;
    }

    if ((session.TranscodingInfo?.IsVideoDirect || !session.TranscodingInfo?.VideoCodec) && session.TranscodingInfo?.IsAudioDirect) {
        return 'Remux';
    }

    if (session.TranscodingInfo?.IsVideoDirect) {
        return 'DirectStream';
    }

    if (session.PlayState?.PlayMethod === 'Transcode') {
        return 'Transcode';
    }

    if (session.PlayState?.PlayMethod === 'DirectStream') {
        return 'DirectPlay';
    }

    if (session.PlayState?.PlayMethod === 'DirectPlay') {
        return 'DirectPlay';
    }

    return null;
}

export default {
    getDisplayPlayMethod
};
