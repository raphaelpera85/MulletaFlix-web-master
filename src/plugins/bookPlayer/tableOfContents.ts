import escapeHTML from 'escape-html';
import dialogHelper from '../../components/dialogHelper/dialogHelper';
import layoutManager from 'components/layoutManager';

interface Chapter {
    href: string;
    label: string;
    depth: number;
    source: string;
}

interface BookPlayerRef {
    rendition: any;
    tocElement: TableOfContents | null;
    chapterMap: Chapter[];
    theme: string;
    THEMES: Record<string, { body: { color: string; background: string } }>;
}

export default class TableOfContents {
    private bookPlayer: BookPlayerRef;
    private rendition: any;
    private elem: HTMLElement | null = null;

    private readonly handleDialogClosed: () => void;

    constructor(bookPlayer: BookPlayerRef) {
        this.bookPlayer = bookPlayer;
        this.rendition = bookPlayer.rendition;

        this.handleDialogClosed = this.onDialogClosed.bind(this);

        this.createMediaElement();
    }

    destroy(): void {
        const elem = this.elem;
        if (elem) {
            this.unbindEvents();
            dialogHelper.close(elem);
        }

        this.bookPlayer.tocElement = null;
    }

    bindEvents(): void {
        const elem = this.elem!;

        elem.addEventListener('close', this.handleDialogClosed, { once: true });
        elem.querySelector('.btnBookplayerTocClose')!.addEventListener('click', this.handleDialogClosed, { once: true });
    }

    unbindEvents(): void {
        const elem = this.elem!;

        elem.removeEventListener('close', this.handleDialogClosed);
        elem.querySelector('.btnBookplayerTocClose')!.removeEventListener('click', this.handleDialogClosed);
    }

    onDialogClosed(): void {
        this.destroy();
    }

    replaceLinks(contents: HTMLElement, f: (href: string) => void): void {
        const links = contents.querySelectorAll('a[href]');

        links.forEach((link) => {
            const anchor = link as HTMLAnchorElement;
            const href = anchor.getAttribute('href')!;

            anchor.onclick = () => {
                f(href);
                return false;
            };
        });
    }

    chapterTocItem(chapter: Chapter): string {
        let itemHtml = '<li>';

        const margin = chapter.depth ? ` style="margin-left:${chapter.depth * 1.25}rem"` : '';
        itemHtml += `<a${margin} data-source="${escapeHTML(chapter.source || 'navigation')}" style="color: ${layoutManager.mobile ? this.bookPlayer.THEMES[this.bookPlayer.theme].body.color : 'inherit'}" href="${escapeHTML(chapter.href)}">${escapeHTML(chapter.label)}</a>`;

        itemHtml += '</li>';
        return itemHtml;
    }

    createMediaElement(): void {
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

        this.replaceLinks(elem, (href: string) => {
            const relative = href.includes('#') && !href.startsWith('http') ? href : rendition.book.path.relative(href);
            rendition.display(relative);
            this.destroy();
        });

        this.elem = elem;

        this.bindEvents();
        dialogHelper.open(elem);
    }
}
