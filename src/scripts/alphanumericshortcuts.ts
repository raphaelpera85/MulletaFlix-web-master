import dom from '../utils/dom';
import focusManager from '../components/focusManager';

interface AlphaNumericShortcutOptions {
    itemsContainer: HTMLElement;
}

let inputDisplayElement: HTMLDivElement | null = null;
let currentDisplayText = '';
let currentDisplayTextContainer: HTMLElement | null = null;
let alphanumericShortcutTimeout: ReturnType<typeof setTimeout> | null = null;

function onKeyDown(this: AlphaNumericShortcuts, e: KeyboardEvent): void {
    if (e.ctrlKey || e.shiftKey || e.altKey) {
        return;
    }

    const key = e.key;
    if (!key || !alphanumeric(key)) {
        return;
    }

    const chr = key.toUpperCase();
    if (chr.length === 1) {
        const options = this.options;
        if (!options) {
            return;
        }

        currentDisplayTextContainer = options.itemsContainer;
        onAlphanumericKeyPress(chr);
    }
}

function alphanumeric(value: string): boolean {
    return /^[0-9a-zA-Z]+$/.test(value);
}

function ensureInputDisplayElement(): void {
    if (!inputDisplayElement) {
        inputDisplayElement = document.createElement('div');
        inputDisplayElement.classList.add('alphanumeric-shortcut');
        inputDisplayElement.classList.add('hide');

        document.body.appendChild(inputDisplayElement);
    }
}

function clearAlphaNumericShortcutTimeout(): void {
    if (alphanumericShortcutTimeout) {
        clearTimeout(alphanumericShortcutTimeout);
        alphanumericShortcutTimeout = null;
    }
}

function resetAlphaNumericShortcutTimeout(): void {
    clearAlphaNumericShortcutTimeout();
    alphanumericShortcutTimeout = setTimeout(onAlphanumericShortcutTimeout, 2000);
}

function onAlphanumericKeyPress(chr: string): void {
    if (currentDisplayText.length >= 3) {
        return;
    }

    ensureInputDisplayElement();
    currentDisplayText += chr;
    inputDisplayElement!.innerHTML = currentDisplayText;
    inputDisplayElement!.classList.remove('hide');
    resetAlphaNumericShortcutTimeout();
}

function onAlphanumericShortcutTimeout(): void {
    const value = currentDisplayText;
    const container = currentDisplayTextContainer;

    currentDisplayText = '';
    currentDisplayTextContainer = null;

    if (inputDisplayElement) {
        inputDisplayElement.innerHTML = '';
        inputDisplayElement.classList.add('hide');
    }

    clearAlphaNumericShortcutTimeout();
    selectByShortcutValue(container, value);
}

function selectByShortcutValue(container: HTMLElement | null, value: string): void {
    if (!container) {
        return;
    }

    const normalizedValue = value.toUpperCase();
    let focusElem: HTMLElement | null = null;

    if (normalizedValue === '#') {
        focusElem = container.querySelector<HTMLElement>('*[data-prefix]');
    }

    if (!focusElem) {
        focusElem = container.querySelector<HTMLElement>("*[data-prefix^='" + normalizedValue + "']");
    }

    if (focusElem) {
        focusManager.focus(focusElem);
    }
}

class AlphaNumericShortcuts {
    options: AlphaNumericShortcutOptions | null;
    private keyDownHandler: EventListener | null = null;

    constructor(options: AlphaNumericShortcutOptions) {
        this.options = options;

        const keyDownHandler: EventListener = event => onKeyDown.call(this, event as KeyboardEvent);

        dom.addEventListener(window, 'keydown', keyDownHandler, {
            passive: true
        });

        this.keyDownHandler = keyDownHandler;
    }

    destroy(): void {
        const keyDownHandler = this.keyDownHandler;

        if (keyDownHandler) {
            dom.removeEventListener(window, 'keydown', keyDownHandler, {
                passive: true
            });
            this.keyDownHandler = null;
        }

        currentDisplayText = '';
        currentDisplayTextContainer = null;
        clearAlphaNumericShortcutTimeout();
        this.options = null;
    }
}

export default AlphaNumericShortcuts;
