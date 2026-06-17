import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';

import loading from '../../components/loading/loading';
import dialogHelper from '../../components/dialogHelper/dialogHelper';
import keyboardnavigation from '../../scripts/keyboardNavigation';
import { PluginType } from '../../types/plugin.ts';
import Events from '../../utils/events.ts';

import 'material-design-icons-iconfont';
import '../../elements/emby-button/paper-icon-button-light';
import './style.scss';

const SUPPORTED_EXTENSIONS = ['.txt', '.html', '.htm'];
const FONT_SIZES = ['0.95rem', '1.08rem', '1.22rem', '1.4rem', '1.62rem'];
const UNSAFE_ELEMENTS = 'script,style,link,meta,object,embed,iframe,form,input,button,textarea,select';

function getPath(item) {
    return item.Path?.toLowerCase() || '';
}

function escapeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll(UNSAFE_ELEMENTS).forEach((element) => element.remove());
    doc.querySelectorAll('*').forEach((element) => {
        [...element.attributes].forEach((attribute) => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim().toLowerCase();

            if (name.startsWith('on') || value.startsWith('javascript:')) {
                element.removeAttribute(attribute.name);
            }
        });
    });

    return doc.body.innerHTML;
}

export class TextBookPlayer {
    constructor() {
        this.name = 'Text Book Player';
        this.type = PluginType.MediaPlayer;
        this.id = 'textbookplayer';
        this.priority = 2;
        this.fontSizeIndex = 1;

        this.onDialogClosed = this.onDialogClosed.bind(this);
        this.onWindowKeyDown = this.onWindowKeyDown.bind(this);
        this.increaseFontSize = this.increaseFontSize.bind(this);
        this.decreaseFontSize = this.decreaseFontSize.bind(this);
    }

    play(options) {
        this.progress = 0;
        this.loaded = false;
        this.cancellationToken = false;

        loading.show();
        const elem = this.createMediaElement();
        return this.setCurrentSrc(elem, options);
    }

    stop() {
        this.unbindEvents();

        Events.trigger(this, 'stopped', [{
            src: this.item
        }]);

        const elem = this.mediaElement;
        if (elem) {
            dialogHelper.close(elem);
            this.mediaElement = null;
        }

        loading.hide();
        this.cancellationToken = true;
    }

    destroy() {
        this.stop();
    }

    currentItem() {
        return this.item;
    }

    currentTime() {
        return this.progress * 1000;
    }

    duration() {
        return 1000;
    }

    volume() {
        return 100;
    }

    isMuted() {
        return false;
    }

    paused() {
        return false;
    }

    seekable() {
        return true;
    }

    onWindowKeyDown(e) {
        if (!this.loaded || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        const key = keyboardnavigation.getKeyName(e);

        switch (key) {
            case 'KeyL':
            case 'ArrowRight':
            case 'Right':
            case 'PageDown':
                e.preventDefault();
                this.scrollPage(1);
                break;
            case 'KeyJ':
            case 'ArrowLeft':
            case 'Left':
            case 'PageUp':
                e.preventDefault();
                this.scrollPage(-1);
                break;
            case 'Escape':
                e.preventDefault();
                this.stop();
                break;
        }
    }

    onDialogClosed() {
        this.stop();
    }

    bindEvents() {
        const elem = this.mediaElement;
        elem.addEventListener('close', this.onDialogClosed, { once: true });
        elem.querySelector('.btnExit').addEventListener('click', this.onDialogClosed, { once: true });
        elem.querySelector('.btnTextBookIncreaseFontSize').addEventListener('click', this.increaseFontSize);
        elem.querySelector('.btnTextBookDecreaseFontSize').addEventListener('click', this.decreaseFontSize);
        elem.querySelector('.textBookContent').addEventListener('scroll', () => this.updateProgress());
        document.addEventListener('keydown', this.onWindowKeyDown);
    }

    unbindEvents() {
        const elem = this.mediaElement;
        if (elem) {
            elem.removeEventListener('close', this.onDialogClosed);
            elem.querySelector('.btnExit')?.removeEventListener('click', this.onDialogClosed);
            elem.querySelector('.btnTextBookIncreaseFontSize')?.removeEventListener('click', this.increaseFontSize);
            elem.querySelector('.btnTextBookDecreaseFontSize')?.removeEventListener('click', this.decreaseFontSize);
        }

        document.removeEventListener('keydown', this.onWindowKeyDown);
    }

    createMediaElement() {
        let elem = this.mediaElement;
        if (elem) {
            return elem;
        }

        elem = dialogHelper.createDialog({
            exitAnimationDuration: 400,
            size: 'fullscreen',
            autoFocus: false,
            scrollY: false,
            exitAnimation: 'fadeout',
            removeOnClose: true
        });

        elem.id = 'textBookPlayer';
        elem.innerHTML = `<div class="textBookToolbar">
            <button is="paper-icon-button-light" class="autoSize btnTextBookDecreaseFontSize" tabindex="-1">
                <span class="material-icons textBookButtonIcon text_decrease" aria-hidden="true"></span>
            </button>
            <button is="paper-icon-button-light" class="autoSize btnTextBookIncreaseFontSize" tabindex="-1">
                <span class="material-icons textBookButtonIcon text_increase" aria-hidden="true"></span>
            </button>
            <button is="paper-icon-button-light" class="autoSize btnExit" tabindex="-1">
                <span class="material-icons textBookButtonIcon close" aria-hidden="true"></span>
            </button>
        </div>
        <main class="textBookContent" tabindex="0">
            <article class="textBookArticle"></article>
        </main>`;

        dialogHelper.open(elem);
        this.mediaElement = elem;
        this.bindEvents();
        return elem;
    }

    async setCurrentSrc(elem, options) {
        const item = options.items[0];
        this.item = item;
        this.streamInfo = {
            started: true,
            ended: false,
            item,
            mediaSource: {
                Id: item.Id
            }
        };

        const api = toApi(ServerConnections.getApiClient(item));
        const downloadHref = getLibraryApi(api).getDownloadUrl({ itemId: item.Id });
        this.currentSrc = downloadHref;

        const response = await fetch(downloadHref);
        if (!response.ok) {
            throw new Error(`Falha ao baixar livro: ${response.status}`);
        }

        const text = await response.text();
        if (this.cancellationToken) return;

        const article = elem.querySelector('.textBookArticle');
        const path = getPath(item);
        article.innerHTML = path.endsWith('.html') || path.endsWith('.htm')
            ? sanitizeHtml(text)
            : `<pre>${escapeText(text)}</pre>`;

        this.applyFontSize();
        this.loaded = true;

        const content = elem.querySelector('.textBookContent');
        const resume = Math.max(0, Math.min(1, (options.startPositionTicks || 0) / 10000000));
        if (resume > 0) {
            content.scrollTop = (content.scrollHeight - content.clientHeight) * resume;
        }

        loading.hide();
    }

    scrollPage(direction) {
        const content = this.mediaElement?.querySelector('.textBookContent');
        if (!content) return;

        content.scrollBy({
            top: direction * content.clientHeight * 0.86,
            behavior: 'smooth'
        });
    }

    updateProgress() {
        const content = this.mediaElement?.querySelector('.textBookContent');
        if (!content) return;

        const maxScroll = Math.max(1, content.scrollHeight - content.clientHeight);
        this.progress = Math.max(0, Math.min(1, content.scrollTop / maxScroll));
        Events.trigger(this, 'pause');
    }

    applyFontSize() {
        const article = this.mediaElement?.querySelector('.textBookArticle');
        if (article) {
            article.style.fontSize = FONT_SIZES[this.fontSizeIndex];
        }
    }

    increaseFontSize() {
        this.fontSizeIndex = Math.min(FONT_SIZES.length - 1, this.fontSizeIndex + 1);
        this.applyFontSize();
    }

    decreaseFontSize() {
        this.fontSizeIndex = Math.max(0, this.fontSizeIndex - 1);
        this.applyFontSize();
    }

    canPlayMediaType(mediaType) {
        return (mediaType || '').toLowerCase() === 'book';
    }

    canPlayItem(item) {
        const path = getPath(item);
        return SUPPORTED_EXTENSIONS.some((extension) => path.endsWith(extension));
    }
}

export default TextBookPlayer;
