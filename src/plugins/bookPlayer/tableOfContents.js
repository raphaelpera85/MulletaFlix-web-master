import escapeHTML from 'escape-html';
import dialogHelper from '../../components/dialogHelper/dialogHelper';
import layoutManager from 'components/layoutManager';

export default class TableOfContents {
    constructor(bookPlayer) {
        this.bookPlayer = bookPlayer;
        this.rendition = bookPlayer.rendition;

        this.onDialogClosed = this.onDialogClosed.bind(this);

        this.createMediaElement();
    }

    destroy() {
        const elem = this.elem;
        if (elem) {
            this.unbindEvents();
            dialogHelper.close(elem);
        }

        this.bookPlayer.tocElement = null;
    }

    bindEvents() {
        const elem = this.elem;

        elem.addEventListener('close', this.onDialogClosed, { once: true });
        elem.querySelector('.btnBookplayerTocClose').addEventListener('click', this.onDialogClosed, { once: true });
    }

    unbindEvents() {
        const elem = this.elem;

        elem.removeEventListener('close', this.onDialogClosed);
        elem.querySelector('.btnBookplayerTocClose').removeEventListener('click', this.onDialogClosed);
    }

    onDialogClosed() {
        this.destroy();
    }

    replaceLinks(contents, f) {
        const links = contents.querySelectorAll('a[href]');

        links.forEach((link) => {
            const href = link.getAttribute('href');

            link.onclick = () => {
                f(href);
                return false;
            };
        });
    }

    chapterTocItem(chapter) {
        let itemHtml = '<li>';

        const margin = chapter.depth ? ` style="margin-left:${chapter.depth * 1.25}rem"` : '';
        itemHtml += `<a${margin} data-source="${escapeHTML(chapter.source || 'navigation')}" style="color: ${layoutManager.mobile ? this.bookPlayer.THEMES[this.bookPlayer.theme].body.color : 'inherit'}" href="${escapeHTML(chapter.href)}">${escapeHTML(chapter.label)}</a>`;

        itemHtml += '</li>';
        return itemHtml;
    }

    createMediaElement() {
        const rendition = this.rendition;

        const elem = dialogHelper.createDialog({
            size: 'small',
            autoFocus: false,
            removeOnClose: true
        });

        elem.id = 'dialogToc';

        let tocHtml = '<div class="topRightActionButtons">';
        tocHtml += '<button is="paper-icon-button-light" class="autoSize bookplayerButton btnBookplayerTocClose hide-mouse-idle-tv" tabindex="-1"><span class="material-icons bookplayerButtonIcon close" aria-hidden="true"></span></button>';
        tocHtml += '</div>';
        const chapters = this.bookPlayer.chapterMap || [];

        tocHtml += `<ul style="background-color: ${layoutManager.mobile ? this.bookPlayer.THEMES[this.bookPlayer.theme].body.background : 'inherit'}" class="toc">`;
        if (chapters.length) {
            chapters.forEach((chapter) => {
                tocHtml += this.chapterTocItem(chapter);
            });
        } else {
            tocHtml += '<li>Nenhum capítulo foi encontrado neste livro.</li>';
        }

        tocHtml += '</ul>';
        elem.innerHTML = tocHtml;

        this.replaceLinks(elem, (href) => {
            const relative = href.includes('#') && !href.startsWith('http') ? href : rendition.book.path.relative(href);
            rendition.display(relative);
            this.destroy();
        });

        this.elem = elem;

        this.bindEvents();
        dialogHelper.open(elem);
    }
}
