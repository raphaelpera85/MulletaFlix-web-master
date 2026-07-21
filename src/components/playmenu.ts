import actionsheet from './actionSheet/actionSheet';
import datetime from '../scripts/datetime';
import { playbackManager } from './playback/playbackmanager';
import globalize from '../lib/globalize';

interface PlayMenuItem {
    name: string;
    id: string;
}

interface PlayMenuOptions {
    item: any;
    positionTo?: HTMLElement;
}

export function show(options: PlayMenuOptions): void {
    const item = options.item;

    const resumePositionTicks = item.UserData ? item.UserData.PlaybackPositionTicks : null;

    const playableItemId = item.Type === 'Program' ? item.ChannelId : item.Id;

    if (!resumePositionTicks || item.IsFolder) {
        playbackManager.play({
            ids: [playableItemId],
            serverId: item.ServerId
        });
        return;
    }

    const menuItems: PlayMenuItem[] = [];

    menuItems.push({
        name: globalize.translate('ResumeAt', datetime.getDisplayRunningTime(resumePositionTicks)),
        id: 'resume'
    });

    menuItems.push({
        name: globalize.translate('PlayFromBeginning'),
        id: 'play'
    });

    actionsheet.show({

        items: menuItems,
        positionTo: options.positionTo

    }).then(function (id: unknown) {
        switch (id) {
            case 'play':
                playbackManager.play({
                    ids: [playableItemId],
                    serverId: item.ServerId
                });
                break;
            case 'resume':
                playbackManager.play({
                    ids: [playableItemId],
                    startPositionTicks: resumePositionTicks,
                    serverId: item.ServerId
                });
                break;
            case 'queue':
                playbackManager.queue({
                    items: [item]
                });
                break;
            case 'shuffle':
                playbackManager.shuffle(item);
                break;
            default:
                break;
        }
    });
}

export default {
    show: show
};
