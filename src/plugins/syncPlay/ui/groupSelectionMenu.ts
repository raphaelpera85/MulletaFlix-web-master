import SyncPlaySettingsEditor from './settings/SettingsEditor';
import loading from '../../../components/loading/loading';
import toast from '../../../components/toast/toast';
import actionsheet from '../../../components/actionSheet/actionSheet';
import globalize from '../../../lib/globalize';
import playbackPermissionManager from './playbackPermissionManager';
import { pluginManager } from '../../../components/pluginManager';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { PluginType } from '../../../types/plugin.ts';
import Events from '../../../utils/events.ts';

import './groupSelectionMenu.scss';

interface SyncPlayGroup {
    GroupName: string;
    GroupId: string;
    Participants: string[];
}

interface SyncPlayUser {
    localUser?: {
        Name?: string;
        Policy?: {
            SyncPlayAccess?: string;
        };
    };
}

interface SyncPlayApiClientExtensions {
    getSyncPlayGroups(): Promise<{ json(): Promise<SyncPlayGroup[]> }>;
    createSyncPlayGroup(options: { GroupName: string }): void;
    joinSyncPlayGroup(options: { GroupId: string }): void;
    leaveSyncPlayGroup(): void;
}

type SyncPlayApiClient = Parameters<typeof ServerConnections.user>[0] & SyncPlayApiClientExtensions;

interface SyncPlayManagerLike {
    getGroupInfo(): {
        GroupName: string;
        Participants: string[];
    };
    isPlaylistEmpty(): boolean;
    isPlaybackActive(): boolean;
    resumeGroupPlayback(apiClient: SyncPlayApiClient): void;
    haltGroupPlayback(apiClient: SyncPlayApiClient): void;
    getTimeSyncCore(): object;
}

interface SyncPlayPluginLike {
    Manager: SyncPlayManagerLike;
}

class GroupSelectionMenu {
    private syncPlayEnabled = false;

    private SyncPlay: SyncPlayPluginLike | null;

    constructor() {
        this.SyncPlay = pluginManager.firstOfType(PluginType.SyncPlay)?.instance as SyncPlayPluginLike | null;

        if (this.SyncPlay) {
            Events.on(this.SyncPlay.Manager, 'enabled', (_event, enabled) => {
                this.syncPlayEnabled = enabled;
            });
        }

        Events.on(pluginManager, 'registered', (_event0, plugin: { type: PluginType; instance: SyncPlayPluginLike }) => {
            if (plugin.type === PluginType.SyncPlay) {
                this.SyncPlay = plugin.instance;

                Events.on(plugin.instance.Manager, 'enabled', (_event1, enabled) => {
                    this.syncPlayEnabled = enabled;
                });
            }
        });
    }

    private showNewJoinGroupSelection(button: HTMLElement, user: SyncPlayUser, apiClient: SyncPlayApiClient): void {
        const policy = user.localUser?.Policy || {};

        apiClient.getSyncPlayGroups().then((response) => {
            response.json().then((groups) => {
                const menuItems = groups.map((group) => {
                    return {
                        name: group.GroupName,
                        icon: 'person',
                        id: group.GroupId,
                        selected: false,
                        secondaryText: group.Participants.join(', ')
                    };
                });

                if (policy.SyncPlayAccess === 'CreateAndJoinGroups') {
                    menuItems.push({
                        name: globalize.translate('LabelSyncPlayNewGroup'),
                        icon: 'add',
                        id: 'new-group',
                        selected: true,
                        secondaryText: globalize.translate('LabelSyncPlayNewGroupDescription')
                    });
                }

                if (menuItems.length === 0 && policy.SyncPlayAccess === 'JoinGroups') {
                    toast({
                        text: globalize.translate('MessageSyncPlayCreateGroupDenied')
                    });
                    loading.hide();
                    return;
                }

                const menuOptions = {
                    title: globalize.translate('HeaderSyncPlaySelectGroup'),
                    items: menuItems,
                    positionTo: button,
                    border: true,
                    dialogClass: 'syncPlayGroupMenu'
                };

                actionsheet.show(menuOptions).then((id) => {
                    const selectedId = typeof id === 'string' ? id : undefined;

                    if (selectedId === 'new-group') {
                        apiClient.createSyncPlayGroup({
                            GroupName: globalize.translate('SyncPlayGroupDefaultTitle', user.localUser?.Name || '')
                        });
                    } else if (selectedId) {
                        apiClient.joinSyncPlayGroup({
                            GroupId: selectedId
                        });
                    }
                }).catch((error) => {
                    if (error) {
                        console.error('SyncPlay: unexpected error listing groups:', error);
                    }
                });

                loading.hide();
            });
        }).catch((error) => {
            console.error(error);
            loading.hide();
            toast({
                text: globalize.translate('MessageSyncPlayErrorAccessingGroups')
            });
        });
    }

    private showLeaveGroupSelection(button: HTMLElement, user: SyncPlayUser, apiClient: SyncPlayApiClient): void {
        const groupInfo = this.SyncPlay?.Manager.getGroupInfo();
        const menuItems: Array<{ name: string; icon: string; id: string; selected: boolean; secondaryText: string }> = [];

        if (!this.SyncPlay?.Manager.isPlaylistEmpty()
            && !this.SyncPlay?.Manager.isPlaybackActive()) {
            menuItems.push({
                name: globalize.translate('LabelSyncPlayResumePlayback'),
                icon: 'play_circle_filled',
                id: 'resume-playback',
                selected: false,
                secondaryText: globalize.translate('LabelSyncPlayResumePlaybackDescription')
            });
        } else if (this.SyncPlay?.Manager.isPlaybackActive()) {
            menuItems.push({
                name: globalize.translate('LabelSyncPlayHaltPlayback'),
                icon: 'pause_circle_filled',
                id: 'halt-playback',
                selected: false,
                secondaryText: globalize.translate('LabelSyncPlayHaltPlaybackDescription')
            });
        }

        menuItems.push({
            name: globalize.translate('Settings'),
            icon: 'video_settings',
            id: 'settings',
            selected: false,
            secondaryText: globalize.translate('LabelSyncPlaySettingsDescription')
        });

        menuItems.push({
            name: globalize.translate('LabelSyncPlayLeaveGroup'),
            icon: 'meeting_room',
            id: 'leave-group',
            selected: true,
            secondaryText: globalize.translate('LabelSyncPlayLeaveGroupDescription')
        });

        const menuOptions = {
            title: groupInfo?.GroupName || '',
            text: groupInfo?.Participants.join(', ') || '',
            dialogClass: 'syncPlayGroupMenu',
            items: menuItems,
            positionTo: button,
            border: true
        };

        actionsheet.show(menuOptions).then((id) => {
            const selectedId = typeof id === 'string' ? id : undefined;

            if (selectedId === 'resume-playback') {
                this.SyncPlay?.Manager.resumeGroupPlayback(apiClient);
            } else if (selectedId === 'halt-playback') {
                this.SyncPlay?.Manager.haltGroupPlayback(apiClient);
            } else if (selectedId === 'leave-group') {
                apiClient.leaveSyncPlayGroup();
            } else if (selectedId === 'settings') {
                new SyncPlaySettingsEditor(apiClient, this.SyncPlay?.Manager.getTimeSyncCore(), { groupInfo: groupInfo })
                    .embed()
                    .catch((error) => {
                        if (error) {
                            console.error('Error creating SyncPlay settings editor', error);
                        }
                    });
            }
        }).catch((error) => {
            if (error) {
                console.error('SyncPlay: unexpected error showing group menu:', error);
            }
        });

        loading.hide();
    }

    show(button: HTMLElement): void {
        loading.show();

        playbackPermissionManager.check().then(() => {
            console.debug('Playback is allowed.');
        }).catch((error) => {
            console.error('Playback not allowed!', error);
            toast({
                text: globalize.translate('MessageSyncPlayPlaybackPermissionRequired')
            });
        });

        const currentApiClient = ServerConnections.currentApiClient();
        if (!currentApiClient) {
            loading.hide();
            toast({
                text: globalize.translate('MessageSyncPlayNoGroupsAvailable')
            });
            return;
        }

        const apiClient = currentApiClient as SyncPlayApiClient;
        ServerConnections.user(apiClient).then((user: SyncPlayUser) => {
            if (this.syncPlayEnabled) {
                this.showLeaveGroupSelection(button, user, apiClient);
            } else {
                this.showNewJoinGroupSelection(button, user, apiClient);
            }
        }).catch((error) => {
            console.error(error);
            loading.hide();
            toast({
                text: globalize.translate('MessageSyncPlayNoGroupsAvailable')
            });
        });
    }
}

const groupSelectionMenu = new GroupSelectionMenu();
export default groupSelectionMenu;
