import dialogHelper from '../dialogHelper/dialogHelper';
import layoutManager from '../layoutManager';
import scrollHelper from '../../scripts/scrollHelper';
import globalize from '../../lib/globalize';
import dom from '../../utils/dom';
import 'material-design-icons-iconfont';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-input/emby-input';
import '../formdialog.scss';
import template from './prompt.template.html';

interface PromptOptions {
    title?: string;
    description?: string;
    label?: string;
    value?: string;
    confirmText?: string;
    text?: string;
}

interface PromptInputElement extends HTMLInputElement {
    label?: (value: string) => void;
}

function setInputProperties(dlg: HTMLElement, options: PromptOptions): void {
    const txtInput = dlg.querySelector('#txtInput') as PromptInputElement | null;
    if (!txtInput) {
        return;
    }

    if (txtInput.label) {
        txtInput.label(options.label || '');
    } else {
        txtInput.setAttribute('label', options.label || '');
    }
    txtInput.value = options.value || '';
}

function showDialog(options: PromptOptions): Promise<string> {
    const dialogOptions: { removeOnClose: boolean; scrollY: boolean; size?: string } = {
        removeOnClose: true,
        scrollY: false
    };

    if (layoutManager.tv) {
        dialogOptions.size = 'fullscreen';
    }

    const dlg = dialogHelper.createDialog(dialogOptions) as HTMLElement;
    dlg.classList.add('formDialog');
    dlg.innerHTML = globalize.translateHtml(template, 'core');

    if (layoutManager.tv) {
        scrollHelper.centerFocus.on(dlg.querySelector('.formDialogContent') as HTMLElement, false);
    } else {
        (dlg.querySelector('.dialogContentInner') as HTMLElement).classList.add('dialogContentInner-mini');
        dlg.classList.add('dialog-fullscreen-lowres');
    }

    (dlg.querySelector('.btnCancel') as HTMLElement).addEventListener('click', () => {
        dialogHelper.close(dlg);
    });

    (dlg.querySelector('.formDialogHeaderTitle') as HTMLElement).innerText = options.title || '';

    const fieldDescription = dlg.querySelector('.fieldDescription') as HTMLElement;
    if (options.description) {
        fieldDescription.innerText = options.description;
    } else {
        fieldDescription.classList.add('hide');
    }

    setInputProperties(dlg, options);

    let submitValue = '';

    (dlg.querySelector('form') as HTMLFormElement).addEventListener('submit', e => {
        submitValue = (dlg.querySelector('#txtInput') as HTMLInputElement).value;
        e.preventDefault();
        e.stopPropagation();

        setTimeout(() => {
            dialogHelper.close(dlg);
        }, 300);

        return false;
    });

    (dlg.querySelector('.submitText') as HTMLElement).innerText = options.confirmText || globalize.translate('ButtonOk');
    dlg.style.minWidth = `${Math.min(400, dom.getWindowSize().innerWidth - 50)}px`;

    return dialogHelper.open(dlg).then(() => {
        if (layoutManager.tv) {
            scrollHelper.centerFocus.off(dlg.querySelector('.formDialogContent') as HTMLElement, false);
        }

        if (submitValue) {
            return submitValue;
        }

        return Promise.reject();
    });
}

export default function prompt(options: string | PromptOptions): Promise<string> {
    if (typeof options === 'string') {
        options = {
            title: '',
            text: options
        };
    }

    return showDialog(options);
}
