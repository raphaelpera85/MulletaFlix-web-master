// Comics Adapter - delegates to the existing ComicsPlayer
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';

/**
 * Creates a ComicsPlayer instance configured for the given item.
 * Comics always open directly (no conversion needed).
 * @param {object} item - The comic book item to play
 * @returns {Promise<object>} A configured ComicsPlayer instance
 */
export async function createComicsPlayer(item) {
    // Ensure the item path extension is preserved for format detection
    if (!item.Path?.toLowerCase().match(/\.(cbz|cbr|cb7|cbt)$/)) {
        console.warn('ComicsAdapter: Item does not appear to be a comic format', item.Path);
    }

    const { ComicsPlayer } = await import('../comicsPlayer/plugin');
    const player = new ComicsPlayer();

    // Override canPlayItem to accept the item with its original path
    const originalCanPlay = player.canPlayItem.bind(player);
    player.canPlayItem = (i) => originalCanPlay(i) || !!(i.Path?.toLowerCase().match(/\.(cbz|cbr|cb7|cbt)$/));

    return player;
}

export default { createComicsPlayer };