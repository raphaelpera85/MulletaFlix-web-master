/**
 * Module for performing auto-focus.
 * @module components/autoFocuser
 */

import focusManager from './focusManager';
import layoutManager from './layoutManager';

/**
     * Previously selected element.
     */
let activeElement: HTMLElement | null;

/**
     * Returns _true_ if AutoFocuser is enabled.
     */
export function isEnabled(): boolean {
    return layoutManager.tv;
}

/**
     * Start AutoFocuser.
     */
export function enable(): void {
    if (!isEnabled()) {
        return;
    }

    window.addEventListener('focusin', function (e: FocusEvent) {
        activeElement = e.target as HTMLElement;
    });

    console.debug('AutoFocuser enabled');
}

/**
     * Set focus on a suitable element, taking into account the previously selected.
     * @param {HTMLElement | null} [container] - Element to limit scope.
     * @returns {HTMLElement} Focused element.
     */
export function autoFocus(container?: HTMLElement | null): HTMLElement | null {
    if (!isEnabled()) {
        return null;
    }

    const scope = container || document.body;

    let candidates: (HTMLElement | null)[] = [];

    if (activeElement) {
        // These elements are recreated
        if (activeElement.classList.contains('btnPreviousPage')) {
            candidates.push(scope.querySelector('.btnPreviousPage'));
            candidates.push(scope.querySelector('.btnNextPage'));
        } else if (activeElement.classList.contains('btnNextPage')) {
            candidates.push(scope.querySelector('.btnNextPage'));
            candidates.push(scope.querySelector('.btnPreviousPage'));
        } else if (activeElement.classList.contains('btnSelectView')) {
            candidates.push(scope.querySelector('.btnSelectView'));
        }

        candidates.push(activeElement);
    }

    candidates = candidates.concat(Array.from(scope.querySelectorAll('.btnPlay')) as HTMLElement[]);

    let focusedElement: HTMLElement | null = null;

    candidates.every(function (element) {
        if (element && focusManager.isCurrentlyFocusable(element)) {
            focusManager.focus(element);
            focusedElement = element;
            return false;
        }

        return true;
    });

    if (!focusedElement) {
        // FIXME: Multiple itemsContainers
        const itemsContainer = scope.querySelector('.itemsContainer') as HTMLElement | null;

        if (itemsContainer) {
            focusedElement = focusManager.autoFocus(itemsContainer);
        }
    }

    if (!focusedElement) {
        focusedElement = focusManager.autoFocus(scope);
    }

    return focusedElement;
}

export default {
    isEnabled: isEnabled,
    enable: enable,
    autoFocus: autoFocus
};
