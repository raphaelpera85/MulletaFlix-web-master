import * as Helper from './Helper';
import TimeSyncCore from './timeSync/TimeSyncCore';
import PlaybackCore from './PlaybackCore';
import QueueCore from './QueueCore';
import Controller from './Controller';
import toast from '../../../components/toast/toast';
import globalize from '../../../lib/globalize';
import Events from '../../../utils/events.ts';

class Manager {
    private playerFactory: any;

    private apiClient: any;

    private timeSyncCore: TimeSyncCore;

    private playbackCore: PlaybackCore;

    private queueCore: QueueCore;

    private controller: Controller;

    private syncMethod = 'None';

    private groupInfo: any;

    private syncPlayEnabledAt: Date | null;

    private syncPlayReady: boolean;

    private queuedCommand: any;

    private followingGroupPlayback: boolean;

    private lastPlaybackCommand: any;

    private currentPlayer: any;

    private playerWrapper: any;

    private syncEnabled?: boolean;

    constructor(playerFactory: any) {
        this.playerFactory = playerFactory;
        this.apiClient = null;

        this.timeSyncCore = new TimeSyncCore();
        this.playbackCore = new PlaybackCore();
        this.queueCore = new QueueCore();
        this.controller = new Controller();

        this.groupInfo = null;
        this.syncPlayEnabledAt = null;
        this.syncPlayReady = false;
        this.queuedCommand = null;
        this.followingGroupPlayback = true;
        this.lastPlaybackCommand = null;

        this.currentPlayer = null;
        this.playerWrapper = null;
    }

    init(apiClient: any): void {
        this.updateApiClient(apiClient);
        this.playerWrapper = this.playerFactory.getDefaultWrapper(this);

        this.timeSyncCore.init(this);
        this.playbackCore.init(this);
        this.queueCore.init(this);
        this.controller.init(this);

        Events.on(this.timeSyncCore, 'time-sync-server-update', (_event: any, timeOffset: number, ping: number) => {
            if (this.syncEnabled) {
                this.getApiClient().sendSyncPlayPing({
                    Ping: ping
                });
            }
        });
    }

    updateApiClient(apiClient: any): void {
        if (!apiClient) {
            throw new Error('ApiClient is null!');
        }

        this.apiClient = apiClient;
    }

    getTimeSyncCore(): TimeSyncCore {
        return this.timeSyncCore;
    }

    getPlaybackCore(): PlaybackCore {
        return this.playbackCore;
    }

    getQueueCore(): QueueCore {
        return this.queueCore;
    }

    getController(): Controller {
        return this.controller;
    }

    getPlayerWrapper(): any {
        return this.playerWrapper;
    }

    getApiClient(): any {
        return this.apiClient;
    }

    getLastPlaybackCommand(): any {
        return this.lastPlaybackCommand;
    }

    onPlayerChange(newPlayer: any): void {
        this.bindToPlayer(newPlayer);
    }

    bindToPlayer(player: any): void {
        this.releaseCurrentPlayer();

        if (!player) {
            return;
        }

        this.playerWrapper.unbindFromPlayer();

        this.currentPlayer = player;
        this.playerWrapper = this.playerFactory.getWrapper(player, this);

        if (this.isSyncPlayEnabled()) {
            this.playerWrapper.bindToPlayer();
        }

        Events.trigger(this, 'playerchange', [this.currentPlayer]);
    }

    releaseCurrentPlayer(): void {
        this.currentPlayer = null;
        this.playerWrapper.unbindFromPlayer();

        this.playerWrapper = this.playerFactory.getDefaultWrapper(this);
        if (this.isSyncPlayEnabled()) {
            this.playerWrapper.bindToPlayer();
        }

        Events.trigger(this, 'playerchange', [this.currentPlayer]);
    }

    processGroupUpdate(cmd: any, apiClient: any): void {
        console.debug('[SyncPlay.Manager] processGroupUpdate:', cmd);
        switch (cmd.Type) {
            case 'PlayQueue':
                this.queueCore.updatePlayQueue(apiClient, cmd.Data);
                break;
            case 'UserJoined':
                toast(globalize.translate('MessageSyncPlayUserJoined', cmd.Data));
                if (!this.groupInfo.Participants) {
                    this.groupInfo.Participants = [cmd.Data];
                } else {
                    this.groupInfo.Participants.push(cmd.Data);
                }
                Events.trigger(this, 'group-update', [{ ...this.groupInfo }]);
                break;
            case 'UserLeft':
                toast(globalize.translate('MessageSyncPlayUserLeft', cmd.Data));
                if (this.groupInfo.Participants) {
                    this.groupInfo.Participants = this.groupInfo.Participants.filter((user: string) => user !== cmd.Data);
                }
                Events.trigger(this, 'group-update', [{ ...this.groupInfo }]);
                break;
            case 'GroupJoined':
                cmd.Data.LastUpdatedAt = new Date(cmd.Data.LastUpdatedAt);
                this.enableSyncPlay(apiClient, cmd.Data, true);
                Events.trigger(this, 'group-update', [cmd.Data]);
                break;
            case 'SyncPlayIsDisabled':
                toast(globalize.translate('MessageSyncPlayIsDisabled'));
                break;
            case 'NotInGroup':
            case 'GroupLeft':
                this.disableSyncPlay(true);
                Events.trigger(this, 'group-update', []);
                break;
            case 'GroupUpdate':
                cmd.Data.LastUpdatedAt = new Date(cmd.Data.LastUpdatedAt);
                this.groupInfo = cmd.Data;
                Events.trigger(this, 'group-update', [cmd.Data]);
                break;
            case 'StateUpdate':
                Events.trigger(this, 'group-state-update', [cmd.Data.State, cmd.Data.Reason]);
                break;
            case 'GroupDoesNotExist':
                toast(globalize.translate('MessageSyncPlayGroupDoesNotExist'));
                break;
            case 'CreateGroupDenied':
                toast(globalize.translate('MessageSyncPlayCreateGroupDenied'));
                break;
            case 'JoinGroupDenied':
                toast(globalize.translate('MessageSyncPlayJoinGroupDenied'));
                break;
            case 'LibraryAccessDenied':
                toast(globalize.translate('MessageSyncPlayLibraryAccessDenied'));
                break;
            default:
                console.error(`[SyncPlay.Manager] processGroupUpdate: command ${cmd.Type} not recognised.`);
                break;
        }
    }

    processCommand(cmd: any): void {
        if (cmd === null) return;

        if (typeof cmd.When === 'string') {
            cmd.When = new Date(cmd.When);
            cmd.EmittedAt = new Date(cmd.EmittedAt);
            cmd.PositionTicks = cmd.PositionTicks ? parseInt(cmd.PositionTicks, 10) : null;
        }

        if (!this.isSyncPlayEnabled()) {
            console.debug('SyncPlay processCommand: SyncPlay not enabled, ignoring command.', cmd);
            return;
        }

        if (cmd.EmittedAt.getTime() < this.syncPlayEnabledAt!.getTime()) {
            console.debug('SyncPlay processCommand: ignoring old command.', cmd);
            return;
        }

        if (!this.syncPlayReady) {
            console.debug('SyncPlay processCommand: SyncPlay not ready, queued command.', cmd);
            this.queuedCommand = cmd;
            return;
        }

        this.lastPlaybackCommand = cmd;

        if (!this.isPlaybackActive()) {
            console.debug('SyncPlay processCommand: no active player!');
            return;
        }

        const playlistItemId = this.queueCore.getCurrentPlaylistItemId();
        if (cmd.PlaylistItemId !== playlistItemId && cmd.Command !== 'Stop') {
            console.error('SyncPlay processCommand: playlist item does not match!', cmd);
            return;
        }

        console.debug(`SyncPlay will ${cmd.Command} at ${cmd.When} (in ${cmd.When.getTime() - Date.now()} ms)${cmd.PositionTicks ? '' : ' from ' + cmd.PositionTicks}.`);

        this.playbackCore.applyCommand(cmd);
    }

    processStateChange(update: any): void {
        if (update === null || update.State === null || update.Reason === null) return;

        if (!this.isSyncPlayEnabled()) {
            console.debug('SyncPlay processStateChange: SyncPlay not enabled, ignoring group state update.', update);
            return;
        }

        Events.trigger(this, 'group-state-change', [update.State, update.Reason]);
    }

    followGroupPlayback(apiClient: any): Promise<any> {
        this.followingGroupPlayback = true;

        return apiClient.requestSyncPlaySetIgnoreWait({
            IgnoreWait: false
        });
    }

    resumeGroupPlayback(apiClient: any): void {
        this.followGroupPlayback(apiClient).then(() => {
            this.queueCore.startPlayback(apiClient);
        });
    }

    haltGroupPlayback(apiClient: any): void {
        this.followingGroupPlayback = false;

        apiClient.requestSyncPlaySetIgnoreWait({
            IgnoreWait: true
        });
        this.playbackCore.localStop();
    }

    isFollowingGroupPlayback(): boolean {
        return this.followingGroupPlayback;
    }

    enableSyncPlay(apiClient: any, groupInfo: any, showMessage = false): void {
        if (this.isSyncPlayEnabled()) {
            if (groupInfo.GroupId === this.groupInfo.GroupId) {
                console.debug(`SyncPlay enableSyncPlay: group ${this.groupInfo.GroupId} already joined.`);
                return;
            } else {
                console.warn(`SyncPlay enableSyncPlay: switching from group ${this.groupInfo.GroupId} to group ${groupInfo.GroupId}.`);
                this.disableSyncPlay(false);
            }

            showMessage = false;
        }

        this.groupInfo = groupInfo;

        this.syncPlayEnabledAt = groupInfo.LastUpdatedAt;
        this.playerWrapper.bindToPlayer();

        Events.trigger(this, 'enabled', [true]);

        Helper.waitForEventOnce(this.timeSyncCore, 'time-sync-server-update').then(() => {
            this.syncPlayReady = true;
            this.processCommand(this.queuedCommand);
            this.queuedCommand = null;
        });

        this.syncPlayReady = false;
        this.followingGroupPlayback = true;

        this.timeSyncCore.forceUpdate();

        if (showMessage) {
            toast(globalize.translate('MessageSyncPlayEnabled'));
        }
    }

    disableSyncPlay(showMessage = false): void {
        this.syncPlayEnabledAt = null;
        this.syncPlayReady = false;
        this.followingGroupPlayback = true;
        this.lastPlaybackCommand = null;
        this.queuedCommand = null;
        this.playbackCore.syncEnabled = false;
        Events.trigger(this, 'enabled', [false]);
        this.playerWrapper.unbindFromPlayer();

        if (showMessage) {
            toast(globalize.translate('MessageSyncPlayDisabled'));
        }
    }

    isSyncPlayEnabled(): boolean {
        return this.syncPlayEnabledAt !== null;
    }

    getGroupInfo(): any {
        return this.groupInfo;
    }

    getStats(): any {
        return {
            TimeSyncDevice: this.timeSyncCore.getActiveDeviceName(),
            TimeSyncOffset: this.timeSyncCore.getTimeOffset().toFixed(2),
            PlaybackDiff: this.playbackCore.playbackDiffMillis.toFixed(2),
            SyncMethod: this.syncMethod
        };
    }

    isPlaybackActive(): boolean {
        return this.playerWrapper.isPlaybackActive();
    }

    isRemote(): boolean {
        return this.playerWrapper.isRemote();
    }

    isPlaylistEmpty(): boolean {
        return this.queueCore.isPlaylistEmpty();
    }

    isPlaying(): boolean {
        if (!this.lastPlaybackCommand) {
            return false;
        }

        return this.lastPlaybackCommand.Command === 'Unpause';
    }

    showSyncIcon(syncMethod: string): void {
        this.syncMethod = syncMethod;
        Events.trigger(this, 'syncing', [true, this.syncMethod]);
    }

    clearSyncIcon(): void {
        this.syncMethod = 'None';
        Events.trigger(this, 'syncing', [false, this.syncMethod]);
    }
}

export default Manager;
