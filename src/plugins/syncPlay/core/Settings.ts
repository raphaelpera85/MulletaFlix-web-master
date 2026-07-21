/**
 * Module that manages SyncPlay settings.
 * @module components/syncPlay/core/Settings
 */
import appSettings from '../../../scripts/settings/appSettings';

/**
 * Prefix used when saving SyncPlay settings.
 */
const PREFIX = 'syncPlay';

/**
 * Gets the value of a setting.
 * @param name The name of the setting.
 * @returns The value.
 */
export function getSetting(name: string): string | null {
    return appSettings.get(name, PREFIX);
}

/**
 * Sets the value of a setting. Triggers an update if the new value differs from the old one.
 * @param name The name of the setting.
 * @param value The value of the setting.
 */
export function setSetting(name: string, value: string): void {
    appSettings.set(name, value, PREFIX);
}
