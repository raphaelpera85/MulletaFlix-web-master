import SubtitleSettings from '../../../components/subtitlesettings/subtitlesettings';
import * as userSettings from '../../../scripts/settings/userSettings';
import autoFocuser from '../../../components/autoFocuser';

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
    let subtitleSettingsInstance: SettingsInstance | undefined;

    const userId = params.userId || ApiClient.getCurrentUserId();
    const currentSettings = userId === ApiClient.getCurrentUserId() ? userSettings : new UserSettings();

    view.addEventListener('viewshow', function () {
        if (subtitleSettingsInstance) {
            subtitleSettingsInstance.loadData();
            return;
        }

        subtitleSettingsInstance = new SubtitleSettings({
            serverId: ApiClient.serverId(),
            userId: userId,
            element: view.querySelector('.settingsContainer') as HTMLElement,
            userSettings: currentSettings,
            enableSaveButton: true,
            enableSaveConfirmation: true,
            autoFocus: autoFocuser.isEnabled()
        }) as SettingsInstance;
    });

    view.addEventListener('viewdestroy', function () {
        if (subtitleSettingsInstance) {
            subtitleSettingsInstance.destroy();
            subtitleSettingsInstance = undefined;
        }
    });
}
