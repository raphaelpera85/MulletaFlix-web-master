import DOMPurify from 'dompurify';
import escapeHtml from 'escape-html';
import dialogHelper from '../dialogHelper/dialogHelper';
import dom from '../../utils/dom';
import layoutManager from '../layoutManager';
import scrollHelper from '../../scripts/scrollHelper';
import globalize from '../../lib/globalize';
import 'material-design-icons-iconfont';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-input/emby-input';
import '../formdialog.scss';
import '../../styles/flexstyles.scss';
import template from './dialog.template.html';

interface DialogButtonOption {
    id: string;
    name: string;
    type?: string;
    description?: string;
}

interface DialogCreateOptions {
    removeOnClose?: boolean;
    scrollY?: boolean;
    size?: string;
}

interface DialogOptions {
    dialogOptions?: DialogCreateOptions;
    buttons?: DialogButtonOption[];
    html?: string;
    text?: string;
    title?: string;
}

interface FormDialogElement extends HTMLDivElement {
    dialogContainer?: HTMLDivElement | null;
    animationConfig?: {
        entry: {
            name: string;
            timing: {
                duration: number;
                easing: string;
            };
        };
        exit: {
            name: string;
            timing: {
                duration: number;
                easing: string;
                fill: string;
            };
        };
    };
}

function showDialog(options: DialogOptions = { dialogOptions: {}, buttons: [] }): Promise<string> {
    const buttonOptions = options.buttons || [];
    const dialogOptions: DialogCreateOptions = {
        removeOnClose: true,
        scrollY: false,
        ...options.dialogOptions
    };

    const enableTvLayout = layoutManager.tv;

    if (enableTvLayout) {
        dialogOptions.size = 'fullscreen';
    }

    const dlg = dialogHelper.createDialog(dialogOptions) as FormDialogElement;

    dlg.classList.add('formDialog');
    dlg.innerHTML = globalize.translateHtml(template, 'core');
    dlg.classList.add('align-items-center');
    dlg.classList.add('justify-content-center');

    const formDialogContent = dlg.querySelector<HTMLElement>('.formDialogContent');
    if (formDialogContent) {
        formDialogContent.classList.add('no-grow');

        if (enableTvLayout) {
            formDialogContent.style.maxWidth = '50%';
            formDialogContent.style.maxHeight = '60%';
            scrollHelper.centerFocus.on(formDialogContent, false);
        } else {
            formDialogContent.style.maxWidth = `${Math.min((buttonOptions.length * 150) + 200, dom.getWindowSize().innerWidth - 50)}px`;
            dlg.classList.add('dialog-fullscreen-lowres');
        }
    }

    const headerTitle = dlg.querySelector<HTMLElement>('.formDialogHeaderTitle');
    if (headerTitle) {
        if (options.title) {
            headerTitle.innerText = options.title || '';
        } else {
            headerTitle.classList.add('hide');
        }
    }

    const displayText = options.html || options.text || '';
    const dialogText = dlg.querySelector<HTMLElement>('.text');
    if (dialogText) {
        dialogText.innerHTML = DOMPurify.sanitize(displayText);
    }

    if (!displayText) {
        dlg.querySelector<HTMLElement>('.dialogContentInner')?.classList.add('hide');
    }

    let html = '';
    let hasDescriptions = false;

    for (let i = 0, length = buttonOptions.length; i < length; i++) {
        const item = buttonOptions[i];
        const autoFocus = i === 0 ? ' autofocus' : '';

        let buttonClass = 'btnOption raised formDialogFooterItem formDialogFooterItem-autosize';

        if (item.type) {
            buttonClass += ` button-${item.type}`;
        }

        if (item.description) {
            hasDescriptions = true;
        }

        if (hasDescriptions) {
            buttonClass += ' formDialogFooterItem-vertical formDialogFooterItem-nomarginbottom';
        }

        html += `<button is="emby-button" type="button" class="${buttonClass}" data-id="${item.id}"${autoFocus}>${escapeHtml(item.name)}</button>`;

        if (item.description) {
            html += `<div class="formDialogFooterItem formDialogFooterItem-autosize fieldDescription" style="margin-top:.25em!important;margin-bottom:1.25em!important;">${item.description}</div>`;
        }
    }

    const footer = dlg.querySelector<HTMLElement>('.formDialogFooter');
    if (footer) {
        footer.innerHTML = html;

        if (hasDescriptions) {
            footer.classList.add('formDialogFooter-vertical');
        }
    }

    let dialogResult: string | null = null;
    function onButtonClick(this: HTMLButtonElement): void {
        dialogResult = this.getAttribute('data-id');
        dialogHelper.close(dlg);
    }

    const dialogButtons = dlg.querySelectorAll<HTMLButtonElement>('.btnOption');
    for (let i = 0, length = dialogButtons.length; i < length; i++) {
        dialogButtons[i].addEventListener('click', onButtonClick);
    }

    return dialogHelper.open(dlg).then(() => {
        if (enableTvLayout && formDialogContent) {
            scrollHelper.centerFocus.off(formDialogContent, false);
        }

        if (dialogResult) {
            return dialogResult;
        }

        return Promise.reject();
    });
}

export function show(text: string | DialogOptions, title?: string): Promise<string> {
    let options: DialogOptions;
    if (typeof text === 'string') {
        options = {
            title,
            text
        };
    } else {
        options = text;
    }

    return showDialog(options);
}

export default {
    show
};
