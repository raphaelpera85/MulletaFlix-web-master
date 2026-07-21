import DisplaySettings from '../../../components/displaySettings/displaySettings';
import * as userSettings from '../../../scripts/settings/userSettings';
import autoFocuser from '../../../components/autoFocuser';

const UserSettings = userSettings.UserSettings;

interface DisplayControllerParams {
    userId?: string;
}

interface DisplaySettingsInstance {
    loadData(): void;
    destroy(): void;
}

declare const ApiClient: {
    getCurrentUserId(): string;
    serverId(): string;
};

export default function (view: HTMLElement, params: DisplayControllerParams): void {
    let settingsInstance: DisplaySettingsInstance | undefined;

    const userId = params.userId || ApiClient.getCurrentUserId();
    const currentSettings = userId === ApiClient.getCurrentUserId() ? userSettings : new UserSettings();

    view.addEventListener('viewshow', function () {
        if (settingsInstance) {
            settingsInstance.loadData();
            return;
        }

        settingsInstance = new DisplaySettings({
            serverId: ApiClient.serverId(),
            userId: userId,
            element: view.querySelector('.settingsContainer'),
            userSettings: currentSettings,
            enableSaveButton: true,
            enableSaveConfirmation: true,
            autoFocus: autoFocuser.isEnabled()
        }) as DisplaySettingsInstance;
    });

    view.addEventListener('viewdestroy', function () {
        if (settingsInstance) {
            settingsInstance.destroy();
            settingsInstance = undefined;
        }
    });
}
