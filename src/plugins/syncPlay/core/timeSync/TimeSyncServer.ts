/**
 * Module that manages time syncing with server.
 * @module components/syncPlay/core/timeSync/TimeSyncServer
 */

import TimeSync from './TimeSync';

type PingResult = {
    requestSent: Date;
    requestReceived: Date;
    responseSent: Date;
    responseReceived: Date;
};

/**
 * Class that manages time syncing with server.
 */
class TimeSyncServer extends TimeSync {
    /**
     * Makes a ping request to the server.
     */
    override async requestPing(): Promise<PingResult> {
        const apiClient = this.manager.getApiClient();
        const requestSent = new Date();
        const response = await apiClient.getServerTime();
        const responseReceived = new Date();
        const data = await response.json();

        return {
            requestSent: requestSent,
            requestReceived: new Date(data.RequestReceptionTime),
            responseSent: new Date(data.ResponseTransmissionTime),
            responseReceived: responseReceived
        };
    }
}

export default TimeSyncServer;
