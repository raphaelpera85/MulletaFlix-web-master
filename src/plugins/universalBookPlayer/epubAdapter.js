// EPUB Adapter - integrates with BookReader/Epub endpoint
// Uses the existing BookPlayer to render EPUB content
// but feeds it from the BookReader API endpoint instead of the Download endpoint

import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';

/**
 * Creates a BookPlayer instance configured to use the BookReader/Epub endpoint
 * instead of the default Download endpoint.
 * @param {object} item - The book item to play
 * @returns {Promise<object>} A configured BookPlayer-like instance
 */
export async function createEpubPlayer(item) {
    const api = toApi(ServerConnections.getApiClient());
    const baseUrl = api.basePath;
    const epubUrl = `${baseUrl}/Items/${item.Id}/BookReader/Epub`;

    // Store the BookReader URL on the item for the UniversalBookPlayer to use
    item._bookReaderEpubUrl = epubUrl;
    // Patch Path to trigger the EPUB player
    item._originalPath = item.Path;
    item.Path = (item.Path || '').replace(/\.[^.]+$/, '.epub') || item.Path;

    // Lazy-import the BookPlayer to render the EPUB
    const { BookPlayer } = await import('../bookPlayer/plugin');
    const player = new BookPlayer();

    // Override canPlayItem to accept the patched item
    player.canPlayItem = (i) => !!(i._bookReaderEpubUrl || i.Path?.toLowerCase().endsWith('.epub'));

    // Override setCurrentSrc to use the BookReader URL
    const originalSetSrc = player.setCurrentSrc.bind(player);
    player.setCurrentSrc = (elem, options) => {
        const currentItem = options.items?.[0];
        if (currentItem?._bookReaderEpubUrl) {
            return _setCurrentSrcWithBookReader(player, elem, options, currentItem._bookReaderEpubUrl);
        }
        // EPUB but without BookReader URL: use default Download endpoint
        currentItem.Path = (currentItem.Path || '').replace(/\.epub$/, '.epub');
        return originalSetSrc(elem, options);
    };

    return player;
}

function _setCurrentSrcWithBookReader(player, elem, options, epubUrl) {
    const item = options.items[0];
    player.item = item;
    player.streamInfo = {
        started: true,
        ended: false,
        item: item,
        mediaSource: { Id: item.Id }
    };

    return new Promise((resolve, reject) => {
        import('epubjs').then(({ default: epubjs }) => {
            const book = epubjs(epubUrl, { openAs: 'epub' });
            const rendition = book.renderTo('bookPlayerContainer', {
                width: '100%',
                height: '100%',
                flow: 'paginated'
            });

            player.currentSrc = epubUrl;
            player.rendition = rendition;
            const theme = player.theme || 'dark';
            const themes = player.THEMES || {
                dark: { body: { color: '#d8dadc', background: '#000', 'font-size': 'medium' } }
            };

            rendition.themes.register('default', themes[theme]);
            rendition.themes.select('default');

            return rendition.display().then(() => {
                player.bindEvents?.();
                const percentageTicks = options.startPositionTicks / 10000000;
                if (percentageTicks !== 0.0) {
                    return book.locations.generate(1024).then(() => {
                        const resumeLocation = book.locations.cfiFromPercentage(percentageTicks);
                        return rendition.display(resumeLocation);
                    });
                }
                return book.locations.generate(1024);
            }).then(() => {
                player.loaded = true;
                rendition.on('relocated', (locations) => {
                    const progress = book.locations.percentageFromCfi(locations.start.cfi);
                    player.progress = progress;
                    import('../../utils/events').then(({ default: Events }) => {
                        Events.trigger(player, 'pause');
                    });
                });
                player.buildChapterMap?.(book);
                resolve();
            }).catch(reject);
        }).catch(reject);
    });
}

export default { createEpubPlayer };