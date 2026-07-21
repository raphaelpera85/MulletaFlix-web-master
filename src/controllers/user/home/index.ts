import HomescreenSettings from '../../../components/homeScreenSettings/homeScreenSettings';
import * as userSettings from '../../../scripts/settings/userSettings';
import autoFocuser from '../../../components/autoFocuser';
import '../../../components/listview/listview.scss';

const UserSettings = userSettings.UserSettings;

interface UserHomeApiClient {
    getCurrentUserId(): string;
    serverId(): string;
}

interface UserHomeViewParams {
    userId?: string;
}

interface SettingsInstance {
    loadData(): void;
    destroy(): void;
}

interface UserSettingsContract {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    setUserInfo(userId: string, apiClient: unknown): Promise<void>;
    [key: string]: unknown;
}

declare const ApiClient: UserHomeApiClient;

export default function (view: HTMLElement, params: UserHomeViewParams): void {
    let homescreenSettingsInstance: SettingsInstance | undefined;

    const userId = params.userId || ApiClient.getCurrentUserId();
    const currentSettings: UserSettingsContract = userId === ApiClient.getCurrentUserId()
        ? (userSettings as unknown as UserSettingsContract)
        : (new UserSettings() as unknown as UserSettingsContract);

    view.addEventListener('viewshow', function () {
        if (homescreenSettingsInstance) {
            homescreenSettingsInstance.loadData();
            return;
        }

        homescreenSettingsInstance = new HomescreenSettings({
            serverId: ApiClient.serverId(),
            userId: userId,
            element: view.querySelector('.homeScreenSettingsContainer') as HTMLElement,
            userSettings: currentSettings,
            enableSaveButton: true,
            enableSaveConfirmation: true,
            autoFocus: autoFocuser.isEnabled()
        }) as SettingsInstance;
    });

    view.addEventListener('viewdestroy', function () {
        if (homescreenSettingsInstance) {
            homescreenSettingsInstance.destroy();
            homescreenSettingsInstance = undefined;
        }
    });
}
