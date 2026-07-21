/**
 * Module alphaPicker.
 * @module components/alphaPicker/alphaPicker
 */

import focusManager from '../focusManager';
import layoutManager from '../layoutManager';
import dom from '../../utils/dom';
import globalize from '../../lib/globalize';
import './style.scss';
import '../../elements/emby-button/paper-icon-button-light';
import 'material-design-icons-iconfont';

const selectedButtonClass = 'alphaPickerButton-selected';

interface AlphaPickerOptions {
    element: HTMLElement;
    itemsContainer?: HTMLElement;
    itemClass?: string;
    mode?: string;
    valueChangeEvent?: string;
    [key: string]: any;
}

interface Query {
    NameLessThan?: string;
    NameStartsWith?: string;
    SortBy: string;
    [key: string]: any;
}

function focus(this: HTMLElement): void {
    const scope = this;
    const selected = scope.querySelector(`.${selectedButtonClass}`) as HTMLElement | null;

    if (selected) {
        focusManager.focus(selected);
    } else {
        focusManager.autoFocus(scope, true);
    }
}

function getAlphaPickerButtonClassName(vertical: boolean): string {
    let alphaPickerButtonClassName = 'alphaPickerButton';

    if (layoutManager.tv) {
        alphaPickerButtonClassName += ' alphaPickerButton-tv';
    }

    if (vertical) {
        alphaPickerButtonClassName += ' alphaPickerButton-vertical';
    }

    return alphaPickerButtonClassName;
}

function getLetterButton(l: string, vertical: boolean): string {
    return `<button data-value="${l}" class="${getAlphaPickerButtonClassName(vertical)}">${l}</button>`;
}

function mapLetters(letters: string[], vertical: boolean): string[] {
    return letters.map(l => {
        return getLetterButton(l, vertical);
    });
}

function render(element: HTMLElement, options: AlphaPickerOptions): void {
    element.classList.add('alphaPicker');

    if (layoutManager.tv) {
        element.classList.add('alphaPicker-tv');
    }

    const vertical = element.classList.contains('alphaPicker-vertical');

    if (!vertical) {
        element.classList.add('focuscontainer-x');
    }

    let html = '';
    let letters: string[];

    const alphaPickerButtonClassName = getAlphaPickerButtonClassName(vertical);

    let rowClassName = 'alphaPickerRow';

    if (vertical) {
        rowClassName += ' alphaPickerRow-vertical';
    }

    html += `<div class="${rowClassName}">`;
    if (options.mode === 'keyboard') {
        html += `<button data-value=" " is="paper-icon-button-light" class="${alphaPickerButtonClassName}" aria-label="${globalize.translate('ButtonSpace')}"><span class="material-icons alphaPickerButtonIcon space_bar" aria-hidden="true"></span></button>`;
    } else {
        letters = ['#'];
        html += mapLetters(letters, vertical).join('');
    }

    letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    html += mapLetters(letters, vertical).join('');

    if (options.mode === 'keyboard') {
        html += `<button data-value="backspace" is="paper-icon-button-light" class="${alphaPickerButtonClassName}" aria-label="${globalize.translate('ButtonBackspace')}"><span class="material-icons alphaPickerButtonIcon backspace" aria-hidden="true"></span></button>`;
        html += '</div>';

        letters = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        html += `<div class="${rowClassName}">`;
        html += '<br/>';
        html += mapLetters(letters, vertical).join('');
        html += '</div>';
    } else {
        html += '</div>';
    }

    element.innerHTML = html;

    element.classList.add('focusable');
    element.focus = focus as any;
}

export class AlphaPicker {
    options: AlphaPickerOptions;
    _currentValue: string | null = null;
    enabled: (enabled: boolean) => void = () => {};
    visible: (visible: boolean) => void = () => {};

    constructor(options: AlphaPickerOptions) {
        const self = this;

        this.options = options;

        const element = options.element;
        const itemsContainer = options.itemsContainer;
        const itemClass = options.itemClass;

        let itemFocusValue: string | null;
        let itemFocusTimeout: ReturnType<typeof setTimeout> | null;

        function onItemFocusTimeout(): void {
            itemFocusTimeout = null;
            self.value(itemFocusValue, true);
        }

        let alphaFocusedElement: HTMLElement | null;
        let alphaFocusTimeout: ReturnType<typeof setTimeout> | null;

        function onAlphaFocusTimeout(): void {
            alphaFocusTimeout = null;

            if (document.activeElement === alphaFocusedElement) {
                const value = alphaFocusedElement!.getAttribute('data-value');
                self.value(value, true);
            }
        }

        function onAlphaPickerInKeyboardModeClick(e: MouseEvent): void {
            const alphaPickerButton = dom.parentWithClass(e.target as HTMLElement, 'alphaPickerButton') as HTMLElement | null;

            if (alphaPickerButton) {
                const value = alphaPickerButton.getAttribute('data-value');

                element.dispatchEvent(new CustomEvent('alphavalueclicked', {
                    cancelable: false,
                    detail: {
                        value
                    }
                }));
            }
        }

        function onAlphaPickerClick(this: HTMLElement, e: MouseEvent): void {
            const alphaPickerButton = dom.parentWithClass(e.target as HTMLElement, 'alphaPickerButton') as HTMLElement | null;

            if (alphaPickerButton) {
                const value = alphaPickerButton.getAttribute('data-value');
                if ((self._currentValue || '').toUpperCase() === (value || '').toUpperCase()) {
                    self.value(null, true);
                } else {
                    self.value(value, true);
                }
            }
        }

        function onAlphaPickerFocusIn(e: FocusEvent): void {
            if (alphaFocusTimeout) {
                clearTimeout(alphaFocusTimeout);
                alphaFocusTimeout = null;
            }

            const alphaPickerButton = dom.parentWithClass(e.target as HTMLElement, 'alphaPickerButton') as HTMLElement | null;

            if (alphaPickerButton) {
                alphaFocusedElement = alphaPickerButton;
                alphaFocusTimeout = setTimeout(onAlphaFocusTimeout, 600);
            }
        }

        function onItemsFocusIn(e: FocusEvent): void {
            const item = dom.parentWithClass(e.target as HTMLElement, itemClass!) as HTMLElement | null;

            if (item) {
                const prefix = item.getAttribute('data-prefix');
                if (prefix?.length) {
                    itemFocusValue = prefix[0];
                    if (itemFocusTimeout) {
                        clearTimeout(itemFocusTimeout);
                    }
                    itemFocusTimeout = setTimeout(onItemFocusTimeout, 100);
                }
            }
        }

        this.enabled = function (enabled: boolean): void {
            if (enabled) {
                if (itemsContainer) {
                    itemsContainer.addEventListener('focus', onItemsFocusIn as EventListener, true);
                }

                if (options.mode === 'keyboard') {
                    element.addEventListener('click', onAlphaPickerInKeyboardModeClick);
                }

                if (options.valueChangeEvent !== 'click') {
                    element.addEventListener('focus', onAlphaPickerFocusIn as EventListener, true);
                } else {
                    element.addEventListener('click', onAlphaPickerClick.bind(element));
                }
            } else {
                if (itemsContainer) {
                    itemsContainer.removeEventListener('focus', onItemsFocusIn as EventListener, true);
                }

                element.removeEventListener('click', onAlphaPickerInKeyboardModeClick);
                element.removeEventListener('focus', onAlphaPickerFocusIn as EventListener, true);
                element.removeEventListener('click', onAlphaPickerClick.bind(element));
            }
        };

        render(element, options);

        this.enabled(true);
        this.visible(true);
    }

    value(value?: string | null, applyValue?: boolean): string | null {
        const element = this.options.element;
        let btn: HTMLElement | null = null;
        let selected: HTMLElement | null;

        if (value !== undefined) {
            if (value != null) {
                value = value.toUpperCase();
                this._currentValue = value;

                if (this.options.mode !== 'keyboard') {
                    selected = element.querySelector(`.${selectedButtonClass}`) as HTMLElement | null;

                    try {
                        btn = element.querySelector(`.alphaPickerButton[data-value='${value}']`) as HTMLElement | null;
                    } catch (err) {
                        console.error('error in querySelector:', err);
                    }

                    if (btn && btn !== selected) {
                        btn.classList.add(selectedButtonClass);
                    }
                    if (selected && selected !== btn) {
                        selected.classList.remove(selectedButtonClass);
                    }
                }
            } else {
                this._currentValue = value;

                selected = element.querySelector(`.${selectedButtonClass}`) as HTMLElement | null;
                if (selected) {
                    selected.classList.remove(selectedButtonClass);
                }
            }
        }

        if (applyValue) {
            element.dispatchEvent(new CustomEvent('alphavaluechanged', {
                cancelable: false,
                detail: {
                    value
                }
            }));
        }

        return this._currentValue;
    }

    on(name: string, fn: EventListenerOrEventListenerObject): void {
        const element = this.options.element;
        element.addEventListener(name, fn);
    }

    off(name: string, fn: EventListenerOrEventListenerObject): void {
        const element = this.options.element;
        element.removeEventListener(name, fn);
    }

    updateControls(query: Query): void {
        if (query.NameLessThan) {
            this.value('#');
        } else {
            this.value(query.NameStartsWith);
        }

        this.visible(query.SortBy.indexOf('SortName') !== -1);
    }

    focus(): void {
        const element = this.options.element;
        focusManager.autoFocus(element, true);
    }

    destroy(): void {
        const element = this.options.element;
        this.enabled(false);
        element.classList.remove('focuscontainer-x');
        this.options = null as any;
    }
}

export default AlphaPicker;
