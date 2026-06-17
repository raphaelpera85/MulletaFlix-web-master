import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { PluginType } from '../../types/plugin.ts';
import Events from '../../utils/events.ts';
import loading from '../../components/loading/loading';

// Lazy-load adapters for specific formats
const loadEpubPlayer = () => import('./epubAdapter');
const loadComicsPlayer = () => import('./comicsAdapter');
const loadPdfPlayer = () => import('./pdfAdapter');

// Formats and their respective adapters
const FORMAT_MAP = {
    '.epub': { adapter: 'epub', direct: true },
    '.cbz': { adapter: 'comics', direct: true },
    '.cbr': { adapter: 'comics', direct: true },
    '.cb7': { adapter: 'comics', direct: true },
    '.cbt': { adapter: 'comics', direct: true },
    '.pdf': { adapter: 'pdf', direct: false },  // will try conversion first
    '.mobi': { adapter: 'epub', direct: false },  // needs conversion
    '.azw': { adapter: 'epub', direct: false },
    '.azw3': { adapter: 'epub', direct: false },
    '.txt': { adapter: 'epub', direct: false },
    '.html': { adapter: 'epub', direct: false },
    '.htm': { adapter: 'epub', direct: false },
};

export class UniversalBookPlayer {
    constructor() {
        this.name = 'Universal Book Player';
        this.type = PluginType.MediaPlayer;
        this.id = 'universalbookplayer';
        this.priority = 5; // Higher than bookPlayer's priority 1
        this._innerPlayer = null;
        this._currentItem = null;
        this._destroyed = false;
        this._playPromise = null;
    }

    play(options) {
        // Cancel any previous play operation (prevents race condition on double-click)
        if (this._playPromise) {
            this.stop();
        }

        this._destroyed = false;
        this._currentItem = options.items?.[0];
        if (!this._currentItem) {
            return Promise.reject(new Error('No item provided'));
        }

        loading.show();

        this._playPromise = this._determinePlaybackMode(this._currentItem)
            .then((mode) => this._initializePlayerMode(mode))
            .then(() => {
                if (this._destroyed) {
                    return Promise.reject(new Error('Player was destroyed during initialization'));
                }
                if (this._innerPlayer) {
                    return this._innerPlayer.play(options);
                }
                return Promise.reject(new Error('No player available for this format'));
            });

        return this._playPromise;
    }

    stop() {
        this._destroyed = true;
        this._playPromise = null;
        if (this._innerPlayer) {
            this._innerPlayer.stop();
            this._innerPlayer = null;
        }
    }

    destroy() {
        this.stop();
        if (this._innerPlayer) {
            this._innerPlayer.destroy();
        }
        this._innerPlayer = null;
        this._currentItem = null;
    }

    currentItem() {
        return this._innerPlayer?.currentItem() || this._currentItem;
    }

    currentTime() {
        return this._innerPlayer?.currentTime() || 0;
    }

    duration() {
        return this._innerPlayer?.duration() || 1000;
    }

    volume() {
        return this._innerPlayer?.volume() || 100;
    }

    isMuted() {
        return this._innerPlayer?.isMuted() || false;
    }

    paused() {
        return this._innerPlayer?.paused() || false;
    }

    seekable() {
        return this._innerPlayer?.seekable() || true;
    }

    canPlayMediaType(mediaType) {
        return (mediaType || '').toLowerCase() === 'book';
    }

    canPlayItem(item) {
        if (!item) return false;
        if ((item.MediaType || '').toLowerCase() !== 'book') return false;

        const path = item.Path || '';
        const ext = this._getExtension(path);
        return !!FORMAT_MAP[ext];
    }

    /**
     * Determines how the book should be played based on its format.
     * For non-direct formats, it checks the /BookReader/Status endpoint.
     */
    _determinePlaybackMode(item) {
        const path = item.Path || '';
        const ext = this._getExtension(path);
        const format = FORMAT_MAP[ext];

        if (!format) {
            return Promise.resolve({ mode: 'unsupported', ext });
        }

        if (format.direct) {
            return Promise.resolve({ mode: 'direct', ext, adapter: format.adapter });
        }

        // Check backend for conversion status / readiness
        return this._checkBookReaderStatus(item.Id)
            .then((status) => {
                if (status === 'Direct' || status === 'Ready') {
                    return { mode: 'converted', ext, adapter: 'epub' };
                }
                if (status === 'Converting') {
                    loading.show();
                    // Poll until ready
                    return this._pollConversionStatus(item.Id, 30)
                        .then((finalStatus) => {
                            if (finalStatus === 'Ready') {
                                return { mode: 'converted', ext, adapter: 'epub' };
                            }
                            return { mode: 'unsupported', ext };
                        });
                }
                if (status === 'Unsupported' || status === 'Failed') {
                    // Fallback: try to open directly with native player (PDF, etc.)
                    if (format.adapter === 'pdf') {
                        return { mode: 'direct_passthrough', ext, adapter: 'pdf' };
                    }
                    return { mode: 'unsupported', ext };
                }
                return { mode: 'unsupported', ext };
            })
            .catch(() => {
                // If BookReader endpoint fails, fallback to direct play if possible
                if (format.adapter === 'pdf') {
                    return { mode: 'direct_passthrough', ext, adapter: 'pdf' };
                }
                return { mode: 'unsupported', ext };
            });
    }

    _checkBookReaderStatus(itemId) {
        const api = toApi(ServerConnections.getApiClient());
        const url = `${api.basePath}/Items/${itemId}/BookReader/Status`;

        return api.axiosInstance.get(url)
            .then((response) => response.data?.Status || 'Unsupported')
            .catch(() => 'Unsupported');
    }

    _pollConversionStatus(itemId, maxRetries) {
        let attempts = 0;

        const check = () => {
            return this._checkBookReaderStatus(itemId).then((status) => {
                if (status === 'Ready' || status === 'Direct') {
                    return status;
                }
                if (status === 'Failed' || status === 'Unsupported') {
                    return status;
                }
                if (attempts >= maxRetries) {
                    return 'Failed';
                }
                attempts++;
                return new Promise((resolve) => setTimeout(resolve, 2000)).then(check);
            });
        };

        return check();
    }

    _initializePlayerMode(mode) {
        if (mode.mode === 'unsupported') {
            return this._showUnsupportedError();
        }

        // For converted EPUB, we need to intercept the item's download URL
        // to point it to the BookReader/Epub endpoint
        if (mode.mode === 'converted') {
            return this._patchItemForConversion(this._currentItem).then(() => {
                return this._loadAdapter('epub');
            });
        }

        if (mode.mode === 'direct_passthrough' && mode.adapter === 'pdf') {
            return this._loadAdapter('pdf');
        }

        return this._loadAdapter(mode.adapter);
    }

    _patchItemForConversion(item) {
        // Replace item.Path so the epub player loads from BookReader endpoint
        const api = toApi(ServerConnections.getApiClient());
        const baseUrl = api.basePath;
        const epubUrl = `${baseUrl}/Items/${item.Id}/BookReader/Epub`;

        // Store original
        this._originalPath = item.Path;

        // Patch Path to trigger the EPUB player but with our conversion endpoint
        // The epub player uses Download endpoint; we override by making it
        // look like an EPUB that uses BookReader
        item.Path = item.Path?.replace(/\.[^.]+$/, '.epub') || item.Path;
        // Store the custom URL for the EPUB adapter to pick up
        item._bookReaderEpubUrl = epubUrl;

        return Promise.resolve();
    }

    _loadAdapter(adapterName) {
        const adapterLoaders = {
            epub: loadEpubPlayer,
            comics: loadComicsPlayer,
            pdf: loadPdfPlayer,
        };

        const loader = adapterLoaders[adapterName];
        if (!loader) {
            return Promise.reject(new Error(`No adapter found for ${adapterName}`));
        }

        return loader().then((module) => {
            if (adapterName === 'epub') {
                // Use the epubAdapter to create a BookPlayer with BookReader/Epub integration
                return module.createEpubPlayer(this._currentItem).then((player) => {
                    this._innerPlayer = player;
                });
            } else if (adapterName === 'comics') {
                return module.createComicsPlayer(this._currentItem).then((player) => {
                    this._innerPlayer = player;
                });
            } else if (adapterName === 'pdf') {
                return module.createPdfPlayer(this._currentItem).then((player) => {
                    this._innerPlayer = player;
                });
            }

            return Promise.reject(new Error(`Unknown adapter: ${adapterName}`));
        });
    }

    _setCurrentSrcWithBookReader(elem, options, epubUrl) {
        // Similar to BookPlayer.setCurrentSrc but uses the conversion URL
        const item = options.items[0];
        this._innerPlayer.item = item;
        this._innerPlayer.streamInfo = {
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

                this._innerPlayer.currentSrc = epubUrl;
                this._innerPlayer.rendition = rendition;
                const theme = this._innerPlayer.theme || 'dark';
                const themes = this._innerPlayer.THEMES || {
                    dark: { body: { color: '#d8dadc', background: '#000', 'font-size': 'medium' } }
                };

                rendition.themes.register('default', themes[theme]);
                rendition.themes.select('default');

                return rendition.display().then(() => {
                    this._innerPlayer.bindEvents?.();
                    const percentageTicks = options.startPositionTicks / 10000000;
                    if (percentageTicks !== 0.0) {
                        return book.locations.generate(1024).then(() => {
                            const resumeLocation = book.locations.cfiFromPercentage(percentageTicks);
                            return rendition.display(resumeLocation);
                        });
                    }
                    return book.locations.generate(1024);
                }).then(() => {
                    this._innerPlayer.loaded = true;
                    rendition.on('relocated', (locations) => {
                        const progress = book.locations.percentageFromCfi(locations.start.cfi);
                        this._innerPlayer.progress = progress;
                        Events.trigger(this._innerPlayer, 'pause');
                    });
                    this._innerPlayer.buildChapterMap?.(book);
                    loading.hide();
                    resolve();
                }).catch(reject);
            }).catch(reject);
        });
    }

    _showUnsupportedError() {
        loading.hide();

        // Dispatch an error that the app can pick up
        import('../../components/toast/toast').then(({ default: toast }) => {
            toast({
                text: 'This book format is not supported for reading. Try downloading the file instead.',
                timeout: 8000,
                class: 'error'
            });
        });

        return Promise.reject(new Error('Unsupported book format'));
    }

    _getExtension(path) {
        if (!path) return '';
        const idx = path.lastIndexOf('.');
        if (idx < 0) return '';
        return path.slice(idx).toLowerCase();
    }

    getBufferedRanges() {
        return this._innerPlayer?.getBufferedRanges?.() || [{ start: 0, end: 10000000 }];
    }
}

export default UniversalBookPlayer;
