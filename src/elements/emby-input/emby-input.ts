import browser from '../../scripts/browser';
import dom from '../../utils/dom';
import './emby-input.scss';
import 'webcomponents.js/webcomponents-lite';

const EmbyInputPrototype: HTMLInputElement = Object.create(HTMLInputElement.prototype);

let inputId: number = 0;
let supportsFloatingLabel: boolean = false;

if (Object.getOwnPropertyDescriptor && Object.defineProperty) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') as PropertyDescriptor | undefined;

    // descriptor returning null in webos
    if (descriptor?.configurable) {
        const baseSetMethod = descriptor.set as (this: HTMLInputElement, value: string) => void;
        descriptor.set = function (this: HTMLInputElement, value: string): void {
            baseSetMethod.call(this, value);

            this.dispatchEvent(new CustomEvent('valueset', {
                bubbles: false,
                cancelable: false
            }));
        };

        Object.defineProperty(HTMLInputElement.prototype, 'value', descriptor);
        supportsFloatingLabel = true;
    }
}

(EmbyInputPrototype as any).createdCallback = function (this: HTMLInputElement & { labelElement: HTMLLabelElement }): void {
    if (!this.id) {
        this.id = 'embyinput' + inputId;
        inputId++;
    }

    if (this.classList.contains('emby-input')) {
        return;
    }

    this.classList.add('emby-input');

    const parentNode = this.parentNode as HTMLElement;
    const document = this.ownerDocument;
    const label = document.createElement('label');
    label.innerText = this.getAttribute('label') || '';
    label.classList.add('inputLabel');
    label.classList.add('inputLabelUnfocused');

    label.htmlFor = this.id;
    parentNode.insertBefore(label, this);
    this.labelElement = label;

    dom.addEventListener(this, 'focus', function (this: HTMLInputElement & { labelElement: HTMLLabelElement }): void {
        onChange.call(this);

        // For Samsung orsay devices
        if ((document as any).attachIME) {
            (document as any).attachIME(this);
        }

        label.classList.add('inputLabelFocused');
        label.classList.remove('inputLabelUnfocused');
    }, {
        passive: true
    });

    dom.addEventListener(this, 'blur', function (this: HTMLInputElement & { labelElement: HTMLLabelElement }): void {
        onChange.call(this);
        label.classList.remove('inputLabelFocused');
        label.classList.add('inputLabelUnfocused');
    }, {
        passive: true
    });

    dom.addEventListener(this, 'change', onChange as EventListener, {
        passive: true
    });
    dom.addEventListener(this, 'input', onChange as EventListener, {
        passive: true
    });
    dom.addEventListener(this, 'valueset', onChange as EventListener, {
        passive: true
    });

    //Make sure the IME pops up if this is the first/default element on the page
    if (browser.orsay && this === document.activeElement && (document as any).attachIME) {
        (document as any).attachIME(this);
    }
};

function onChange(this: HTMLInputElement & { labelElement: HTMLLabelElement }): void {
    const label = this.labelElement;
    if (this.value) {
        label.classList.remove('inputLabel-float');
    } else {
        const instanceSupportsFloat: boolean = supportsFloatingLabel && this.type !== 'date' && this.type !== 'time';

        if (instanceSupportsFloat) {
            label.classList.add('inputLabel-float');
        }
    }
}

(EmbyInputPrototype as any).attachedCallback = function (this: HTMLInputElement & { labelElement: HTMLLabelElement }): void {
    this.labelElement.htmlFor = this.id;
    onChange.call(this);
};

(EmbyInputPrototype as any).label = function (this: HTMLInputElement & { labelElement: HTMLLabelElement }, text: string): void {
    this.labelElement.innerText = text;
};

document.registerElement('emby-input', {
    prototype: EmbyInputPrototype,
    extends: 'input'
});
