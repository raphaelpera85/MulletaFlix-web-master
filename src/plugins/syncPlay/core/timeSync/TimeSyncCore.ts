import appSettings from '../../../../scripts/settings/appSettings';
import Events from '../../../../utils/events.ts';
import { toFloat } from '../../../../utils/string.ts';
import { getSetting } from '../Settings';
import TimeSyncServer from './TimeSyncServer';

function offsetDate(date: Date, offset: number): Date {
    return new Date(date.getTime() + offset);
}

class TimeSyncCore {
    private manager: any;

    private timeSyncServer: TimeSyncServer | null;

    timeSyncDeviceId: string;

    extraTimeOffset: number;

    constructor() {
        this.manager = null;
        this.timeSyncServer = null;

        this.timeSyncDeviceId = getSetting('timeSyncDevice') || 'server';
        this.extraTimeOffset = toFloat(getSetting('extraTimeOffset'), 0.0);
    }

    init(syncPlayManager: any): void {
        this.manager = syncPlayManager;
        this.timeSyncServer = new TimeSyncServer(syncPlayManager);

        Events.on(this.timeSyncServer, 'update', (_event, error, timeOffset, ping) => {
            if (error) {
                console.debug('SyncPlay TimeSyncCore: time sync with server issue:', error);
                return;
            }

            Events.trigger(this, 'time-sync-server-update', [timeOffset, ping]);
        });

        Events.on(appSettings, 'change', (_event, name) => {
            if (name === 'extraTimeOffset') {
                this.extraTimeOffset = toFloat(getSetting('extraTimeOffset'), 0.0);
            }
        });
    }

    forceUpdate(): void {
        this.timeSyncServer?.forceUpdate();
    }

    getActiveDeviceName(): string {
        return 'Server';
    }

    remoteDateToLocal(remote: Date): Date {
        const date = this.timeSyncServer ? this.timeSyncServer.remoteDateToLocal(remote) : remote;
        return offsetDate(date, -this.extraTimeOffset);
    }

    localDateToRemote(local: Date): Date {
        const date = this.timeSyncServer ? this.timeSyncServer.localDateToRemote(local) : local;
        return offsetDate(date, this.extraTimeOffset);
    }

    getTimeOffset(): number {
        return (this.timeSyncServer ? this.timeSyncServer.getTimeOffset() : 0) + this.extraTimeOffset;
    }
}

export default TimeSyncCore;
