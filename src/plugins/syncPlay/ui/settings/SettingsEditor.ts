import { setSetting } from '../../core/Settings';
import dialogHelper from '../../../../components/dialogHelper/dialogHelper';
import layoutManager from '../../../../components/layoutManager';
import { pluginManager } from '../../../../components/pluginManager';
import loading from '../../../../components/loading/loading';
import toast from '../../../../components/toast/toast';
import globalize from '../../../../lib/globalize';
import { PluginType } from '../../../../types/plugin.ts';
import Events from '../../../../utils/events.ts';

import 'material-design-icons-iconfont';
import '../../../../elements/emby-input/emby-input';
import '../../../../elements/emby-select/emby-select';
import '../../../../elements/emby-button/emby-button';
import '../../../../elements/emby-button/paper-icon-button-light';
import '../../../../elements/emby-checkbox/emby-checkbox';
import '../../../../components/listview/listview.scss';
import '../../../../components/formdialog.scss';

function centerFocus(elem: Element | null, horiz: boolean, on: boolean): void {
    if (!elem) {
        return;
    }

    import('../../../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        scrollHelper.centerFocus[fn](elem as HTMLElement, horiz);
    });
}

interface SyncPlaySettingsEditorOptions {
    groupInfo?: {
        GroupName?: string;
    };
}

class SettingsEditor {
    private apiClient: any;

    private timeSyncCore: any;

    private options: SyncPlaySettingsEditorOptions;

    private SyncPlay: any;

    private context!: HTMLDivElement & { submitted?: boolean };

    constructor(apiClient: any, timeSyncCore: any, options: SyncPlaySettingsEditorOptions = {}) {
        this.apiClient = apiClient;
        this.timeSyncCore = timeSyncCore;
        this.options = options;
        this.SyncPlay = pluginManager.firstOfType(PluginType.SyncPlay)?.instance;
    }

    async embed(): Promise<void> {
        const dialogOptions: { removeOnClose: boolean; scrollY: boolean; size?: string } = {
            removeOnClose: true,
            scrollY: true
        };

        if (layoutManager.tv) {
            dialogOptions.size = 'fullscreen';
        } else {
            dialogOptions.size = 'small';
        }

        this.context = dialogHelper.createDialog(dialogOptions) as HTMLDivElement & { submitted?: boolean };
        this.context.classList.add('formDialog');

        const { default: editorTemplate } = await import('./editor.html');
        this.context.innerHTML = globalize.translateHtml(editorTemplate, 'core');

        this.context.querySelector('form')?.addEventListener('submit', (event) => {
            if (event) {
                event.preventDefault();
            }
            return false;
        });

        this.context.querySelector('.btnSave')?.addEventListener('click', () => {
            this.onSubmit();
        });

        this.context.querySelector('.btnCancel')?.addEventListener('click', () => {
            dialogHelper.close(this.context);
        });

        await this.initEditor();

        if (layoutManager.tv) {
            centerFocus(this.context.querySelector('.formDialogContent'), false, true);
        }

        return dialogHelper.open(this.context).then(() => {
            if (layoutManager.tv) {
                centerFocus(this.context.querySelector('.formDialogContent'), false, false);
            }

            if (this.context.submitted) {
                return Promise.resolve();
            }

            return Promise.reject();
        });
    }

    async initEditor(): Promise<void> {
        const { context } = this;
        const query = <T extends HTMLElement>(selector: string): T => context.querySelector(selector) as T;

        query<HTMLInputElement>('#txtExtraTimeOffset').value = this.SyncPlay?.Manager.timeSyncCore.extraTimeOffset;
        query<HTMLInputElement>('#chkSyncCorrection').checked = this.SyncPlay?.Manager.playbackCore.enableSyncCorrection;
        query<HTMLInputElement>('#txtMinDelaySpeedToSync').value = this.SyncPlay?.Manager.playbackCore.minDelaySpeedToSync;
        query<HTMLInputElement>('#txtMaxDelaySpeedToSync').value = this.SyncPlay?.Manager.playbackCore.maxDelaySpeedToSync;
        query<HTMLInputElement>('#txtSpeedToSyncDuration').value = this.SyncPlay?.Manager.playbackCore.speedToSyncDuration;
        query<HTMLInputElement>('#txtMinDelaySkipToSync').value = this.SyncPlay?.Manager.playbackCore.minDelaySkipToSync;
        query<HTMLInputElement>('#chkSpeedToSync').checked = this.SyncPlay?.Manager.playbackCore.useSpeedToSync;
        query<HTMLInputElement>('#chkSkipToSync').checked = this.SyncPlay?.Manager.playbackCore.useSkipToSync;
    }

    onSubmit(): void {
        this.save();
        dialogHelper.close(this.context);
    }

    async save(): Promise<void> {
        loading.show();
        await this.saveToAppSettings();
        loading.hide();
        toast(globalize.translate('SettingsSaved'));
        Events.trigger(this, 'saved');
    }

    async saveToAppSettings(): Promise<void> {
        const { context } = this;
        const query = <T extends HTMLElement>(selector: string): T => context.querySelector(selector) as T;

        const extraTimeOffset = query<HTMLInputElement>('#txtExtraTimeOffset').value;
        const syncCorrection = query<HTMLInputElement>('#chkSyncCorrection').checked;
        const minDelaySpeedToSync = query<HTMLInputElement>('#txtMinDelaySpeedToSync').value;
        const maxDelaySpeedToSync = query<HTMLInputElement>('#txtMaxDelaySpeedToSync').value;
        const speedToSyncDuration = query<HTMLInputElement>('#txtSpeedToSyncDuration').value;
        const minDelaySkipToSync = query<HTMLInputElement>('#txtMinDelaySkipToSync').value;
        const useSpeedToSync = query<HTMLInputElement>('#chkSpeedToSync').checked;
        const useSkipToSync = query<HTMLInputElement>('#chkSkipToSync').checked;

        setSetting('extraTimeOffset', extraTimeOffset);
        setSetting('enableSyncCorrection', String(syncCorrection));
        setSetting('minDelaySpeedToSync', minDelaySpeedToSync);
        setSetting('maxDelaySpeedToSync', maxDelaySpeedToSync);
        setSetting('speedToSyncDuration', speedToSyncDuration);
        setSetting('minDelaySkipToSync', minDelaySkipToSync);
        setSetting('useSpeedToSync', String(useSpeedToSync));
        setSetting('useSkipToSync', String(useSkipToSync));

        Events.trigger(this.SyncPlay?.Manager, 'settings-update');
    }
}

export default SettingsEditor;
