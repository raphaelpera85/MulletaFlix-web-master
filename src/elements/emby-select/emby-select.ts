import layoutManager from '../../components/layoutManager';
import browser from '../../scripts/browser';
import actionsheet from '../../components/actionSheet/actionSheet';
import './emby-select.scss';
import 'webcomponents.js/webcomponents-lite';

const EmbySelectPrototype = Object.create(HTMLSelectElement.prototype);

function enableNativeMenu(): boolean {
    // WebView 2 creates dropdown that doesn't work with controller.
    if (browser.edgeUwp || browser.xboxOne) {
        return false;
    }

    // Doesn't seem to work at all
    if (browser.tizen || browser.orsay || browser.web0s) {
        return false;
    }

    // Take advantage of the native input methods
    if (browser.tv) {
        return true;
    }

    return !layoutManager.tv;
}

function triggerChange(select: HTMLSelectElement): void {
    const evt = new Event('change', { bubbles: false, cancelable: true });
    select.dispatchEvent(evt);
}

function setValue(select: HTMLSelectElement, value: string): void {
    select.value = value;
}

function showActionSheet(select: HTMLSelectElement): void {
    const labelElem = getLabel(select);
    const title = labelElem ? (labelElem.textContent || labelElem.innerText) : undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actionsheet.show({
        items: Array.from(select.options) as any[],
        positionTo: select,
        title: title

    }).then(function (value: unknown) {
        setValue(select, value as string);
        triggerChange(select);
    });
}

function getLabel(select: HTMLSelectElement): HTMLElement | null {
    let elem: Node | null = select.previousSibling;
    while (elem && (elem as HTMLElement).tagName !== 'LABEL') {
        elem = elem.previousSibling;
    }
    return elem as HTMLElement | null;
}

function onFocus(this: HTMLSelectElement): void {
    const label = getLabel(this);
    if (label) {
        label.classList.add('selectLabelFocused');
    }
}

function onBlur(this: HTMLSelectElement): void {
    const label = getLabel(this);
    if (label) {
        label.classList.remove('selectLabelFocused');
    }
}

function onMouseDown(this: HTMLSelectElement, e: MouseEvent): void {
    // e.button=0 for primary (left) mouse button click
    if (!e.button && !enableNativeMenu()) {
        e.preventDefault();
        showActionSheet(this);
    }
}

function onKeyDown(this: HTMLSelectElement, e: KeyboardEvent): void {
    // Xbox controller for UWP WebView2 uses keycode 195 to select.
    if ((e.keyCode === 13 || e.keyCode === 195) && !enableNativeMenu()) {
        e.preventDefault();
        showActionSheet(this);
    }
}

let inputId = 0;

EmbySelectPrototype.createdCallback = function (): void {
    if (!this.id) {
        this.id = 'embyselect' + inputId;
        inputId++;
    }

    this.classList.add('emby-select-withcolor');

    if (layoutManager.tv) {
        this.classList.add('emby-select-focusscale');
    }

    this.addEventListener('mousedown', onMouseDown as EventListener);
    this.addEventListener('keydown', onKeyDown as EventListener);

    this.addEventListener('focus', onFocus);
    this.addEventListener('blur', onBlur);
};

EmbySelectPrototype.attachedCallback = function (): void {
    if (this.classList.contains('emby-select')) {
        return;
    }

    this.classList.add('emby-select');

    const label = this.ownerDocument.createElement('label');
    label.innerText = this.getAttribute('label') || '';
    label.classList.add('selectLabel');
    label.htmlFor = this.id;
    this.parentNode?.insertBefore(label, this);

    if (this.classList.contains('emby-select-withcolor')) {
        this.parentNode?.insertAdjacentHTML('beforeend', '<div class="selectArrowContainer"><div style="visibility:hidden;display:none;">0</div><span class="selectArrow material-icons keyboard_arrow_down" aria-hidden="true"></span></div>');
    }
};

EmbySelectPrototype.setLabel = function (text: string): void {
    const label = this.parentNode?.querySelector('label');

    label!.innerText = text;
};

document.registerElement('emby-select', {
    prototype: EmbySelectPrototype,
    extends: 'select'
});
