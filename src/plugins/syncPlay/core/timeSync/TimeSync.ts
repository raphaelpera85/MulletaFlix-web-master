import Events from '../../../../utils/events.ts';

const NumberOfTrackedMeasurements = 8;
const PollingIntervalGreedy = 1000;
const PollingIntervalLowProfile = 60000;
const GreedyPingCount = 3;

type PingResult = {
    requestSent: Date;
    requestReceived: Date;
    responseSent: Date;
    responseReceived: Date;
};

class Measurement {
    private requestSent: number;

    private requestReceived: number;

    private responseSent: number;

    private responseReceived: number;

    constructor(requestSent: Date, requestReceived: Date, responseSent: Date, responseReceived: Date) {
        this.requestSent = requestSent.getTime();
        this.requestReceived = requestReceived.getTime();
        this.responseSent = responseSent.getTime();
        this.responseReceived = responseReceived.getTime();
    }

    getOffset(): number {
        return ((this.requestReceived - this.requestSent) + (this.responseSent - this.responseReceived)) / 2;
    }

    getDelay(): number {
        return (this.responseReceived - this.requestSent) - (this.responseSent - this.requestReceived);
    }

    getPing(): number {
        return this.getDelay() / 2;
    }
}

abstract class TimeSync {
    protected manager: any;

    private pingStop = true;

    private pollingInterval = PollingIntervalGreedy;

    private poller: ReturnType<typeof setTimeout> | null = null;

    private pings = 0;

    private measurement: Measurement | null = null;

    private measurements: Measurement[] = [];

    constructor(syncPlayManager: any) {
        this.manager = syncPlayManager;
    }

    isReady(): boolean {
        return !!this.measurement;
    }

    getTimeOffset(): number {
        return this.measurement ? this.measurement.getOffset() : 0;
    }

    getPing(): number {
        return this.measurement ? this.measurement.getPing() : 0;
    }

    updateTimeOffset(measurement: Measurement): void {
        this.measurements.push(measurement);
        if (this.measurements.length > NumberOfTrackedMeasurements) {
            this.measurements.shift();
        }

        const sortedMeasurements = this.measurements.slice(0);
        sortedMeasurements.sort((a, b) => a.getDelay() - b.getDelay());
        this.measurement = sortedMeasurements[0];
    }

    abstract requestPing(): Promise<PingResult>;

    internalRequestPing(): void {
        if (!this.poller && !this.pingStop) {
            this.poller = setTimeout(() => {
                this.poller = null;
                this.requestPing()
                    .then((result) => this.onPingResponseCallback(result))
                    .catch((error) => this.onPingRequestErrorCallback(error))
                    .finally(() => this.internalRequestPing());
            }, this.pollingInterval);
        }
    }

    onPingResponseCallback(result: PingResult): void {
        const { requestSent, requestReceived, responseSent, responseReceived } = result;
        const measurement = new Measurement(requestSent, requestReceived, responseSent, responseReceived);
        this.updateTimeOffset(measurement);

        if (this.pings >= GreedyPingCount) {
            this.pollingInterval = PollingIntervalLowProfile;
        } else {
            this.pings++;
        }

        Events.trigger(this, 'update', [null, this.getTimeOffset(), this.getPing()]);
    }

    onPingRequestErrorCallback(error: unknown): void {
        console.error(error);
        Events.trigger(this, 'update', [error, null, null]);
    }

    resetMeasurements(): void {
        this.measurement = null;
        this.measurements = [];
    }

    startPing(): void {
        this.pingStop = false;
        this.internalRequestPing();
    }

    stopPing(): void {
        this.pingStop = true;
        if (this.poller) {
            clearTimeout(this.poller);
            this.poller = null;
        }
    }

    forceUpdate(): void {
        this.stopPing();
        this.pollingInterval = PollingIntervalGreedy;
        this.pings = 0;
        this.startPing();
    }

    remoteDateToLocal(remote: Date): Date {
        return new Date(remote.getTime() - this.getTimeOffset());
    }

    localDateToRemote(local: Date): Date {
        return new Date(local.getTime() + this.getTimeOffset());
    }
}

export default TimeSync;
