import browser from '../../scripts/browser';
import dom from '../../utils/dom';
import './emby-checkbox.scss';
import 'webcomponents.js/webcomponents-lite';

const EmbyCheckboxPrototype: HTMLInputElement = Object.create(HTMLInputElement.prototype);

function onKeyDown(this: HTMLInputElement, e: KeyboardEvent): void | false {
    // Don't submit form on enter
    // Real (non-emulator) Tizen does nothing on Space
    if (e.keyCode === 13 || (e.keyCode === 32 && browser.tizen)) {
        e.preventDefault();

        this.checked = !this.checked;

        this.dispatchEvent(new CustomEvent('change', {
            bubbles: true
        }));

        return false;
    }
}

const enableRefreshHack: boolean = browser.tizen || browser.orsay || browser.operaTv || browser.web0s;

function forceRefresh(this: HTMLInputElement, loading?: boolean): void {
    const elem = this.parentNode as HTMLElement;

    elem.style.webkitAnimationName = 'repaintChrome';
    elem.style.webkitAnimationDelay = (loading === true ? '500ms' : '');
    elem.style.webkitAnimationDuration = '10ms';
    elem.style.webkitAnimationIterationCount = '1';

    setTimeout(function () {
        elem.style.webkitAnimationName = '';
    }, (loading === true ? 520 : 20));
}

(EmbyCheckboxPrototype as any).attachedCallback = function (this: HTMLInputElement): void {
    if (this.getAttribute('data-embycheckbox') === 'true') {
        return;
    }

    this.setAttribute('data-embycheckbox', 'true');

    this.classList.add('emby-checkbox');

    const labelElement = this.parentNode as HTMLElement;
    labelElement.classList.add('emby-checkbox-label');

    const labelTextElement = labelElement.querySelector('span') as HTMLElement;

    let outlineClass = 'checkboxOutline';

    const customClass = this.getAttribute('data-outlineclass');
    if (customClass) {
        outlineClass += ' ' + customClass;
    }

    const checkedIcon: string = this.getAttribute('data-checkedicon') || 'check';
    const uncheckedIcon: string = this.getAttribute('data-uncheckedicon') || '';
    const checkHtml = '<span class="material-icons checkboxIcon checkboxIcon-checked ' + checkedIcon + '" aria-hidden="true"></span>';
    const uncheckedHtml = '<span class="material-icons checkboxIcon checkboxIcon-unchecked ' + uncheckedIcon + '" aria-hidden="true"></span>';
    labelElement.insertAdjacentHTML('beforeend', '<span class="' + outlineClass + '">' + checkHtml + uncheckedHtml + '</span>');

    labelTextElement.classList.add('checkboxLabel');

    this.addEventListener('keydown', onKeyDown as unknown as EventListener);

    if (enableRefreshHack) {
        forceRefresh.call(this, true);
        dom.addEventListener(this, 'click', forceRefresh as unknown as EventListener, {
            passive: true
        });
        dom.addEventListener(this, 'blur', forceRefresh as unknown as EventListener, {
            passive: true
        });
        dom.addEventListener(this, 'focus', forceRefresh as unknown as EventListener, {
            passive: true
        });
        dom.addEventListener(this, 'change', forceRefresh as unknown as EventListener, {
            passive: true
        });
    }
};

(EmbyCheckboxPrototype as any).detachedCallback = function (this: HTMLInputElement): void {
    this.removeEventListener('keydown', onKeyDown as unknown as EventListener);

    dom.removeEventListener(this, 'click', forceRefresh as unknown as EventListener, {
        passive: true
    });
    dom.removeEventListener(this, 'blur', forceRefresh as unknown as EventListener, {
        passive: true
    });
    dom.removeEventListener(this, 'focus', forceRefresh as unknown as EventListener, {
        passive: true
    });
    dom.removeEventListener(this, 'change', forceRefresh as unknown as EventListener, {
        passive: true
    });
};

document.registerElement('emby-checkbox', {
    prototype: EmbyCheckboxPrototype,
    extends: 'input'
});
