import dom from '../utils/dom';
import scrollManager from './scrollManager';

const scopes: HTMLElement[] = [];
const focusableTagNames = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'] as const;
const focusableContainerTagNames = ['BODY', 'DIALOG'] as const;
const focusableQuery = focusableTagNames.map(function (tagName) {
    let value = tagName;
    if (value === 'INPUT') {
        value += ':not([type="range"]):not([type="file"])';
    }
    return value + ':not([tabindex="-1"]):not(:disabled)';
}).join(',') + ',.focusable';

interface ElementRect {
    top: number;
    left: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
}

function pushScope(elem: Element): void {
    if (elem instanceof HTMLElement) {
        scopes.push(elem);
    }
}

function popScope(): void {
    if (scopes.length) {
        scopes.length -= 1;
    }
}

function getDefaultScope(): HTMLElement {
    return scopes[0] || document.body;
}

function focus(element: EventTarget | null): void {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    try {
        element.focus({
            preventScroll: scrollManager.isEnabled()
        });
    } catch (err) {
        console.error('Error in focusManager.autoFocus: ' + err);
    }
}

function isFocusable(elem: Element): boolean {
    return elem instanceof HTMLElement
        && (focusableTagNames.includes(elem.tagName as typeof focusableTagNames[number])
            || elem.classList.contains('focusable'));
}

function normalizeFocusable(elem: Element, originalElement: HTMLElement): HTMLElement {
    if (!(elem instanceof HTMLElement)) {
        return originalElement;
    }

    const tagName = elem.tagName;
    if (!tagName || tagName === 'HTML' || tagName === 'BODY') {
        return originalElement;
    }

    return elem;
}

function focusableParent(elem: EventTarget | null): HTMLElement {
    if (!(elem instanceof HTMLElement)) {
        return getDefaultScope();
    }

    const originalElement = elem;
    let current: HTMLElement = elem;

    while (!isFocusable(current)) {
        const parent = current.parentElement;

        if (!parent) {
            return normalizeFocusable(current, originalElement);
        }

        current = parent;
    }

    return normalizeFocusable(current, originalElement);
}

function isCurrentlyFocusableInternal(elem: Element): elem is HTMLElement {
    return elem instanceof HTMLElement && elem.offsetParent !== null;
}

function isCurrentlyFocusable(elem: Element): elem is HTMLElement {
    if (!(elem instanceof HTMLElement)) {
        return false;
    }

    if (!elem.classList.contains('focusable')) {
        const input = elem as HTMLInputElement;

        if (input.disabled) {
            return false;
        }

        if (elem.getAttribute('tabindex') === '-1') {
            return false;
        }

        if (elem.tagName === 'INPUT') {
            const type = input.type;
            if (type === 'range' || type === 'file') {
                return false;
            }
        }
    }

    return isCurrentlyFocusableInternal(elem);
}

function autoFocus(view: Element, defaultToFirst?: boolean, findAutoFocusElement?: boolean): HTMLElement | null {
    if (!(view instanceof HTMLElement)) {
        return null;
    }

    let element: HTMLElement | null = null;

    if (findAutoFocusElement !== false) {
        element = view.querySelector<HTMLElement>('*[autofocus]');
        if (element) {
            focus(element);
            return element;
        }
    }

    if (defaultToFirst !== false) {
        element = getFocusableElements(view, 1, 'noautofocus')[0] ?? null;

        if (element) {
            focus(element);
            return element;
        }
    }

    return null;
}

function getFocusableElements(parent: Element | null, limit?: number, excludeClass?: string): HTMLElement[] {
    const scope = parent instanceof HTMLElement ? parent : getDefaultScope();
    const elems = scope.querySelectorAll<HTMLElement>(focusableQuery);
    const focusableElements: HTMLElement[] = [];

    for (let i = 0, length = elems.length; i < length; i++) {
        const elem = elems[i];

        if (excludeClass && elem.classList.contains(excludeClass)) {
            continue;
        }

        if (isCurrentlyFocusableInternal(elem)) {
            focusableElements.push(elem);

            if (limit && focusableElements.length >= limit) {
                break;
            }
        }
    }

    return focusableElements;
}

function isFocusContainer(elem: Element, direction: number): elem is HTMLElement {
    if (!(elem instanceof HTMLElement)) {
        return false;
    }

    if (focusableContainerTagNames.includes(elem.tagName as typeof focusableContainerTagNames[number])) {
        return true;
    }

    const classList = elem.classList;

    if (classList.contains('focuscontainer')) {
        return true;
    }

    if (direction === 0) {
        return classList.contains('focuscontainer-x') || classList.contains('focuscontainer-left');
    }

    if (direction === 1) {
        return classList.contains('focuscontainer-x') || classList.contains('focuscontainer-right');
    }

    if (direction === 2) {
        return classList.contains('focuscontainer-y');
    }

    if (direction === 3) {
        return classList.contains('focuscontainer-y') || classList.contains('focuscontainer-down');
    }

    return false;
}

function getFocusContainer(elem: Element, direction: number): HTMLElement {
    if (!(elem instanceof HTMLElement)) {
        return getDefaultScope();
    }

    while (!isFocusContainer(elem, direction)) {
        const parent = elem.parentElement;
        if (!parent) {
            return getDefaultScope();
        }
        elem = parent;
    }

    return elem;
}

function getOffset(elem: Element): ElementRect {
    if (elem instanceof HTMLElement && elem.getBoundingClientRect) {
        const rect = elem.getBoundingClientRect();
        return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom
        };
    }

    return {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0
    };
}

function intersectsInternal(a1: number, a2: number, b1: number, b2: number): boolean {
    return (b1 >= a1 && b1 <= a2) || (b2 >= a1 && b2 <= a2);
}

function intersects(a1: number, a2: number, b1: number, b2: number): boolean {
    return intersectsInternal(a1, a2, b1, b2) || intersectsInternal(b1, b2, a1, a2);
}

function nav(activeElement: Element | Window | null, direction: number, container?: Element | null, focusableElements?: ArrayLike<Element>): void {
    activeElement = activeElement instanceof Element ? activeElement : document.activeElement;

    if (activeElement) {
        activeElement = focusableParent(activeElement);
    }

    const focusContainer = container || (activeElement ? getFocusContainer(activeElement, direction) : getDefaultScope());

    if (!activeElement || activeElement === document.body) {
        autoFocus(focusContainer, true, false);
        return;
    }

    const activeHtmlElement = activeElement instanceof HTMLElement ? activeElement : null;
    if (!activeHtmlElement) {
        autoFocus(focusContainer, true, false);
        return;
    }

    const focusableContainer = dom.parentWithClass(activeHtmlElement, 'focusable');
    const rect = getOffset(activeElement);

    const point1x = parseFloat(String(rect.left)) || 0;
    const point1y = parseFloat(String(rect.top)) || 0;
    const point2x = parseFloat(String(point1x + rect.width - 1)) || point1x;
    const point2y = parseFloat(String(point1y + rect.height - 1)) || point1y;

    const sourceMidX = rect.left + (rect.width / 2);
    const sourceMidY = rect.top + (rect.height / 2);

    const focusable = focusableElements || focusContainer.querySelectorAll<HTMLElement>(focusableQuery);

    let minDistance = Infinity;
    let nearestElement: Element | undefined;

    for (let i = 0, length = focusable.length; i < length; i++) {
        const curr = focusable[i];

        if (curr === activeElement) {
            continue;
        }
        if (curr === focusableContainer) {
            continue;
        }

        const elementRect = getOffset(curr);
        if (!elementRect.width && !elementRect.height) {
            continue;
        }

        switch (direction) {
            case 0:
                if (elementRect.left >= rect.left || elementRect.right === rect.right) {
                    continue;
                }
                break;
            case 1:
                if (elementRect.right <= rect.right || elementRect.left === rect.left) {
                    continue;
                }
                break;
            case 2:
                if (elementRect.top >= rect.top || elementRect.bottom >= rect.bottom) {
                    continue;
                }
                break;
            case 3:
                if (elementRect.bottom <= rect.bottom || elementRect.top <= rect.top) {
                    continue;
                }
                break;
            default:
                break;
        }

        const x = elementRect.left;
        const y = elementRect.top;
        const x2 = x + elementRect.width - 1;
        const y2 = y + elementRect.height - 1;

        const intersectX = intersects(point1x, point2x, x, x2);
        const intersectY = intersects(point1y, point2y, y, y2);

        const midX = elementRect.left + (elementRect.width / 2);
        const midY = elementRect.top + (elementRect.height / 2);

        let distX = 0;
        let distY = 0;

        switch (direction) {
            case 0:
                distX = Math.abs(point1x - Math.min(point1x, x2));
                distY = intersectY ? 0 : Math.abs(sourceMidY - midY);
                break;
            case 1:
                distX = Math.abs(point2x - Math.max(point2x, x));
                distY = intersectY ? 0 : Math.abs(sourceMidY - midY);
                break;
            case 2:
                distY = Math.abs(point1y - Math.min(point1y, y2));
                distX = intersectX ? 0 : Math.abs(sourceMidX - midX);
                break;
            case 3:
                distY = Math.abs(point2y - Math.max(point2y, y));
                distX = intersectX ? 0 : Math.abs(sourceMidX - midX);
                break;
            default:
                break;
        }

        const dist = Math.sqrt(distX * distX + distY * distY);

        if (dist < minDistance) {
            nearestElement = curr;
            minDistance = dist;
        }
    }

    if (nearestElement) {
        if (activeElement) {
        const nearestElementFocusableParent = dom.parentWithClass(nearestElement as HTMLElement, 'focusable');
            if (nearestElementFocusableParent
                && nearestElementFocusableParent !== nearestElement
                && focusableContainer !== nearestElementFocusableParent
            ) {
                nearestElement = nearestElementFocusableParent;
            }
        }
        focus(nearestElement);
    }
}

function sendText(text: string): void {
    const elem = document.activeElement as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (elem) {
        elem.value = text;
    }
}

function focusFirst(container: Element | null, focusableSelector: string): void {
    if (!container) {
        return;
    }
    const elems = container.querySelectorAll<HTMLElement>(focusableSelector);

    for (let i = 0, length = elems.length; i < length; i++) {
        const elem = elems[i];

        if (isCurrentlyFocusableInternal(elem)) {
            focus(elem);
            break;
        }
    }
}

function focusLast(container: Element | null, focusableSelector: string): void {
    if (!container) {
        return;
    }
    const elems = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).reverse();

    for (let i = 0, length = elems.length; i < length; i++) {
        const elem = elems[i];

        if (isCurrentlyFocusableInternal(elem)) {
            focus(elem);
            break;
        }
    }
}

function moveFocus(sourceElement: Element | Window | null, container: Element | null, focusableSelector: string, offset: number): void {
    if (!container) {
        return;
    }

    if (!(sourceElement instanceof Element)) {
        sourceElement = document.activeElement;
    }

    const elems = container.querySelectorAll<HTMLElement>(focusableSelector);
    const list: HTMLElement[] = [];

    for (let i = 0, length = elems.length; i < length; i++) {
        const elem = elems[i];

        if (isCurrentlyFocusableInternal(elem)) {
            list.push(elem);
        }
    }

    let currentIndex = -1;

    for (let i = 0, length = list.length; i < length; i++) {
        const elem = list[i];

        if (sourceElement && (sourceElement === elem || elem.contains(sourceElement))) {
            currentIndex = i;
            break;
        }
    }

    if (currentIndex === -1) {
        return;
    }

    let newIndex = currentIndex + offset;
    newIndex = Math.max(0, newIndex);
    newIndex = Math.min(newIndex, list.length - 1);

    const newElem = list[newIndex];
    if (newElem) {
        focus(newElem);
    }
}

export default {
    autoFocus,
    focus,
    focusableParent,
    getFocusableElements,
    moveLeft(sourceElement: Element | Window | null, options?: { container?: Element | null; focusableElements?: ArrayLike<Element> }): void {
        nav(sourceElement, 0, options?.container, options?.focusableElements);
    },
    moveRight(sourceElement: Element | Window | null, options?: { container?: Element | null; focusableElements?: ArrayLike<Element> }): void {
        nav(sourceElement, 1, options?.container, options?.focusableElements);
    },
    moveUp(sourceElement: Element | Window | null, options?: { container?: Element | null; focusableElements?: ArrayLike<Element> }): void {
        nav(sourceElement, 2, options?.container, options?.focusableElements);
    },
    moveDown(sourceElement: Element | Window | null, options?: { container?: Element | null; focusableElements?: ArrayLike<Element> }): void {
        nav(sourceElement, 3, options?.container, options?.focusableElements);
    },
    sendText,
    isCurrentlyFocusable,
    pushScope,
    popScope,
    focusFirst,
    focusLast,
    moveFocus
};
