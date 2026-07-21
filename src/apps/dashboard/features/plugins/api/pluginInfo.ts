import type { PluginInfo } from '@jellyfin/sdk/lib/generated-client/models/plugin-info';
import { PluginStatus } from '@jellyfin/sdk/lib/generated-client/models/plugin-status';

/**
 * WORKAROUND: The Plugins API sometimes returns duplicate entries for the same plugin.
 * This function finds the "best" match by prioritizing disabled entries (which indicate
 * a pending update) over active ones.
 * TODO: Fix server-side to not return duplicate plugin entries.
 */
export const findBestPluginInfo = (
    pluginId: string,
    plugins?: PluginInfo[]
) => {
    if (!plugins) return;
    // Find all plugin entries with a matching ID
    const matches = plugins.filter(p => p.Id === pluginId);
    // Get the first match (or undefined if none)
    const firstMatch = matches?.[0];

    if (matches.length > 1) {
        return matches.find(p => p.Status === PluginStatus.Disabled) // Disabled entries take priority
            || matches.find(p => p.Status === PluginStatus.Restart) // Then entries specifying restart is needed
            || firstMatch; // Fallback to the first match
    }

    return firstMatch;
};

