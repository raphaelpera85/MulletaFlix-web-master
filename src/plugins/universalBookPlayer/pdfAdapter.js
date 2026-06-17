// PDF Adapter - delegates to the existing PDFPlayer
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';

/**
 * Creates a PdfPlayer instance configured for the given item.
 * Falls back to direct PDF play when conversion is not possible.
 * @param {object} item - The PDF item to play
 * @returns {Promise<object>} A configured PdfPlayer instance
 */
export async function createPdfPlayer(item) {
    // Ensure the item path has pdf extension for format detection
    if (!item.Path?.toLowerCase().endsWith('.pdf')) {
        item.Path = (item.Path || '') + '.pdf';
    }

    const { PdfPlayer } = await import('../pdfPlayer/plugin');
    const player = new PdfPlayer();

    // Override canPlayItem to accept PDF items
    const originalCanPlay = player.canPlayItem.bind(player);
    player.canPlayItem = (i) => originalCanPlay(i) || !!(i.Path?.toLowerCase().endsWith('.pdf'));

    return player;
}

export default { createPdfPlayer };