import './emby-toggle.scss';
import 'webcomponents.js/webcomponents-lite';

const EmbyTogglePrototype = Object.create(HTMLInputElement.prototype);

function onKeyDown(this: HTMLInputElement, e: KeyboardEvent): void {
    // Don't submit form on enter
    if (e.keyCode === 13) {
        e.preventDefault();

        this.checked = !this.checked;

        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true
        }));

        return;
    }
}

EmbyTogglePrototype.attachedCallback = function (): void {
    if (this.getAttribute('data-embytoggle') === 'true') {
        return;
    }

    this.setAttribute('data-embytoggle', 'true');

    this.classList.add('mdl-switch__input');

    const labelElement = this.parentNode as HTMLElement;
    labelElement.classList.add('mdl-switch');
    labelElement.classList.add('mdl-js-switch');

    const labelTextElement = labelElement.querySelector('span')!;

    labelElement.insertAdjacentHTML('beforeend', '<div class="mdl-switch__trackContainer"><div class="mdl-switch__track"></div><div class="mdl-switch__thumb"><span class="mdl-switch__focus-helper"></span></div></div>');

    labelTextElement.classList.add('toggleButtonLabel');
    labelTextElement.classList.add('mdl-switch__label');

    this.addEventListener('keydown', onKeyDown as EventListener);
};

document.registerElement('emby-toggle', {
    prototype: EmbyTogglePrototype,
    extends: 'input'
});
