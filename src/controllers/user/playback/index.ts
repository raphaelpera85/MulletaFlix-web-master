import PlaybackSettings from '../../../components/playbackSettings/playbackSettings';
import * as userSettings from '../../../scripts/settings/userSettings';
import autoFocuser from '../../../components/autoFocuser';
import '../../../components/listview/listview.scss';

const UserSettings = userSettings.UserSettings;

interface UserSettingsApiClient {
    getCurrentUserId(): string;
    serverId(): string;
}

interface UserSettingsViewParams {
    userId?: string;
}

interface SettingsInstance {
    loadData(): void;
    destroy(): void;
}

declare const ApiClient: UserSettingsApiClient;

export default function (view: HTMLElement, params: UserSettingsViewParams): void {
    let settingsInstance: SettingsInstance | undefined;

    const userId = params.userId || ApiClient.getCurrentUserId();
    const currentSettings = userId === ApiClient.getCurrentUserId() ? userSettings : new UserSettings();

    view.addEventListener('viewshow', function () {
        if (settingsInstance) {
            settingsInstance.loadData();
            return;
        }

        settingsInstance = new PlaybackSettings({
            serverId: ApiClient.serverId(),
            userId,
            element: view.querySelector('.settingsContainer') as HTMLElement,
            userSettings: currentSettings,
            enableSaveButton: true,
            enableSaveConfirmation: true,
            autoFocus: autoFocuser.isEnabled()
        }) as SettingsInstance;
    });

    view.addEventListener('viewdestroy', function () {
        if (settingsInstance) {
            settingsInstance.destroy();
            settingsInstance = undefined;
        }
    });
}
