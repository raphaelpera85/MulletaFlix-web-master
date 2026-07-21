import focusManager from '../focusManager';
import browser from '../../scripts/browser';
import layoutManager from '../layoutManager';
import inputManager from '../../scripts/inputManager';
import { toBoolean } from '../../utils/string.ts';
import { hide } from '../loading/loading.ts';
import dom from '../../utils/dom';

import { history } from 'RootAppRouter';

import './dialoghelper.scss';
import '../../styles/scrollstyles.scss';

interface DialogElement extends HTMLDivElement {
    dialogContainer?: HTMLDivElement | null;
    backdrop?: HTMLDivElement | null;
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

interface DialogOptions {
    id?: string;
    removeOnClose?: boolean;
    scrollX?: boolean;
    scrollY?: boolean;
    size?: string;
    modal?: boolean;
    autoFocus?: boolean;
    enableHistory?: boolean;
    lockScroll?: boolean;
    entryAnimation?: string;
    exitAnimation?: string;
    entryAnimationDuration?: number;
    exitAnimationDuration?: number;
}

let globalOnOpenCallback: ((dlg: HTMLElement) => void) | null = null;

function enableAnimation(): boolean {
    if (browser.tv) {
        return false;
    }

    return browser.supportsCssAnimation();
}

function removeCenterFocus(dlg: DialogElement): void {
    if (layoutManager.tv) {
        if (dlg.classList.contains('scrollX')) {
            centerFocus(dlg, true, false);
        } else if (dlg.classList.contains('smoothScrollY')) {
            centerFocus(dlg, false, false);
        }
    }
}

function tryRemoveElement(elem: HTMLElement | null | undefined): void {
    const parentNode = elem?.parentNode;
    if (parentNode && elem) {
        try {
            parentNode.removeChild(elem);
        } catch (err) {
            console.error('[dialogHelper] error removing dialog element: ' + err);
        }
    }
}

function isHistoryEnabled(dlg: DialogElement): boolean {
    return dlg.getAttribute('data-history') === 'true';
}

function isOpened(dlg: DialogElement): boolean {
    return !dlg.classList.contains('hide');
}

function removeBackdrop(dlg: DialogElement): void {
    const backdrop = dlg.backdrop;

    if (!backdrop) {
        return;
    }

    dlg.backdrop = null;

    const onAnimationFinish = (): void => {
        tryRemoveElement(backdrop);
    };

    if (enableAnimation()) {
        backdrop.classList.remove('dialogBackdropOpened');
        setTimeout(onAnimationFinish, 300);
        return;
    }

    onAnimationFinish();
}

function centerFocus(elem: DialogElement, horiz: boolean, on: boolean): void {
    import('../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        scrollHelper.centerFocus[fn](elem, horiz);
    });
}

function getAnimationEndHandler(dlg: DialogElement, callback: () => void): EventListener {
    return function handler(): void {
        dom.removeEventListener(dlg, dom.whichAnimationEvent(), handler, { once: true });
        callback();
    };
}

function animateDialogOpen(dlg: DialogElement): void {
    const onAnimationFinish = (): void => {
        focusManager.pushScope(dlg);

        if (dlg.getAttribute('data-autofocus') === 'true') {
            focusManager.autoFocus(dlg);
        }

        if (document.activeElement instanceof HTMLElement && !dlg.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    };

    if (enableAnimation()) {
        dom.addEventListener(
            dlg,
            dom.whichAnimationEvent(),
            getAnimationEndHandler(dlg, onAnimationFinish),
            { once: true });
        return;
    }

    onAnimationFinish();
}

function animateDialogClose(dlg: DialogElement, onAnimationFinish: () => void): void {
    if (enableAnimation()) {
        let animated = true;

        switch (dlg.animationConfig?.exit.name) {
            case 'fadeout':
                dlg.style.animation = `fadeout ${dlg.animationConfig.exit.timing.duration}ms ease-out normal both`;
                break;
            case 'scaledown':
                dlg.style.animation = `scaledown ${dlg.animationConfig.exit.timing.duration}ms ease-out normal both`;
                break;
            case 'slidedown':
                dlg.style.animation = `slidedown ${dlg.animationConfig.exit.timing.duration}ms ease-out normal both`;
                break;
            default:
                animated = false;
                break;
        }

        dom.addEventListener(
            dlg,
            dom.whichAnimationEvent(),
            getAnimationEndHandler(dlg, onAnimationFinish),
            { once: true });

        if (animated) {
            return;
        }
    }

    onAnimationFinish();
}

function shouldLockDocumentScroll(options: DialogOptions): boolean {
    if (options.lockScroll != null) {
        return options.lockScroll;
    }

    if (options.size === 'fullscreen') {
        return true;
    }

    if (('overscroll-behavior-y' in document.body.style) && (options.size || !browser.touch)) {
        return false;
    }

    if (options.size) {
        return true;
    }

    return browser.touch;
}

function addBackdropOverlay(dlg: DialogElement): void {
    const backdrop = document.createElement('div');
    backdrop.classList.add('dialogBackdrop');

    const backdropParent = dlg.dialogContainer || dlg;
    backdropParent.parentNode?.insertBefore(backdrop, backdropParent);
    dlg.backdrop = backdrop;

    void backdrop.offsetWidth;
    backdrop.classList.add('dialogBackdropOpened');

    let clickedElement: EventTarget | null = null;

    dom.addEventListener((dlg.dialogContainer || backdrop), 'mousedown', e => {
        clickedElement = e.target;
    });

    dom.addEventListener((dlg.dialogContainer || backdrop), 'click', e => {
        if (e.target === dlg.dialogContainer && e.target == clickedElement) {
            close(dlg);
        }
    }, {
        passive: true
    });

    dom.addEventListener((dlg.dialogContainer || backdrop), 'contextmenu', e => {
        if (e.target === dlg.dialogContainer) {
            close(dlg);
            e.preventDefault();
        }
    });
}

function onDialogClosed(dlg: DialogElement, removeScrollLockOnClose: boolean, hash: string, finishClose: () => void, unlistenRef: { current: (() => void) | null }, activeElement: Element | null): void {
    if (!isHistoryEnabled(dlg)) {
        inputManager.off(dlg, onBackCommand);
    }

    if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
    }

    removeBackdrop(dlg);
    hide();

    dlg.classList.remove('opened');

    if (removeScrollLockOnClose) {
        document.body.classList.remove('noScroll');
    }

    if (isHistoryEnabled(dlg)) {
        const state = (history.location.state || {}) as DialogHistoryState;
        const dialogs = state.dialogs || [];
        if (dialogs.length > 0) {
            if (dialogs[dialogs.length - 1] === hash) {
                unlistenRef.current = history.listen(finishClose);
                history.back();
            } else if (dialogs.includes(hash)) {
                console.warn('[dialogHelper] dialog "%s" was closed, but is not the last dialog opened', hash);

                unlistenRef.current = history.listen(finishClose);
                history.replace(
                    `${history.location.pathname}${history.location.search}`,
                    {
                        ...state,
                        dialogs: dialogs.filter((dialog: string) => dialog !== hash)
                    }
                );
            }
        }
    }

    if (layoutManager.tv) {
        focusManager.focus(activeElement);
    }

    if (toBoolean(dlg.getAttribute('data-removeonclose'), true)) {
        removeCenterFocus(dlg);

        const dialogContainer = dlg.dialogContainer;
        if (dialogContainer) {
            tryRemoveElement(dialogContainer);
            dlg.dialogContainer = null;
        } else {
            tryRemoveElement(dlg);
        }
    }

    if (!unlistenRef.current) {
        finishClose();
    }
}

function onBackCommand(e: Event): void {
    const evt = e as CustomEvent<{ command?: string }>;
    if (evt.detail.command === 'back') {
        e.preventDefault();
        e.stopPropagation();
    }
}

export function open(dlg: HTMLElement): Promise<{ element: DialogElement }> {
    const dialog = dlg as DialogElement;

    if (globalOnOpenCallback) {
        globalOnOpenCallback(dialog);
    }

    const parent = dialog.parentNode;
    if (parent) {
        parent.removeChild(dialog);
    }

    const dialogContainer = document.createElement('div');
    dialogContainer.classList.add('dialogContainer');
    dialogContainer.appendChild(dialog);
    dialog.dialogContainer = dialogContainer;
    document.body.appendChild(dialogContainer);

    return new Promise((resolve) => {
        const hash = `dlg${new Date().getTime()}`;
        const activeElement = document.activeElement;
        const removeScrollLockOnClose = false;
        const unlistenRef: { current: (() => void) | null } = { current: null };

        dialog.addEventListener('_close', function handler(): void {
            dialog.removeEventListener('_close', handler);
            onDialogClosed(dialog, removeScrollLockOnClose, hash, () => {
                resolve({ element: dialog });
            }, unlistenRef, activeElement);
        });

        const center = !dialog.classList.contains('dialog-fixedSize');
        if (center) {
            dialog.classList.add('centeredDialog');
        }

        dialog.classList.remove('hide');
        addBackdropOverlay(dialog);
        dialog.classList.add('opened');
        dialog.dispatchEvent(new CustomEvent('open', {
            bubbles: false,
            cancelable: false
        }));

        if (dialog.getAttribute('data-lockscroll') === 'true' && !document.body.classList.contains('noScroll')) {
            document.body.classList.add('noScroll');
        }

        animateDialogOpen(dialog);

        if (isHistoryEnabled(dialog)) {
            const state = (history.location.state || {}) as DialogHistoryState;
            const dialogs = state.dialogs || [];
            dialogs.push(hash);

            history.push(
                `${history.location.pathname}${history.location.search}`,
                {
                    ...state,
                    dialogs
                }
            );

            unlistenRef.current = history.listen(() => {});
        } else {
            inputManager.on(dialog, onBackCommand);
        }
    });
}

export function close(dlg: HTMLElement): void {
    const dialog = dlg as DialogElement;

    if (!dialog.classList.contains('hide')) {
        dialog.dispatchEvent(new CustomEvent('closing', {
            bubbles: false,
            cancelable: false
        }));

        const onAnimationFinish = (): void => {
            focusManager.popScope();

            dialog.classList.add('hide');
            dialog.dispatchEvent(new CustomEvent('_close', {
                bubbles: false,
                cancelable: false
            }));
        };

        animateDialogClose(dialog, onAnimationFinish);
    }
}

export function createDialog(options: DialogOptions = {}): DialogElement {
    const dlg = document.createElement('div') as DialogElement;

    if (options.id) {
        dlg.id = options.id;
    }

    dlg.classList.add('focuscontainer');
    dlg.classList.add('hide');

    if (shouldLockDocumentScroll(options)) {
        dlg.setAttribute('data-lockscroll', 'true');
    }

    if (options.enableHistory !== false) {
        dlg.setAttribute('data-history', 'true');
    }

    if (options.modal !== false) {
        dlg.setAttribute('modal', 'modal');
    }

    if (options.autoFocus !== false) {
        dlg.setAttribute('data-autofocus', 'true');
    }

    const defaultEntryAnimation = 'scaleup';
    const defaultExitAnimation = 'scaledown';
    const entryAnimation = options.entryAnimation || defaultEntryAnimation;
    const exitAnimation = options.exitAnimation || defaultExitAnimation;
    const entryAnimationDuration = options.entryAnimationDuration || (options.size !== 'fullscreen' ? 180 : 280);
    const exitAnimationDuration = options.exitAnimationDuration || (options.size !== 'fullscreen' ? 120 : 220);

    dlg.animationConfig = {
        entry: {
            name: entryAnimation,
            timing: {
                duration: entryAnimationDuration,
                easing: 'ease-out'
            }
        },
        exit: {
            name: exitAnimation,
            timing: {
                duration: exitAnimationDuration,
                easing: 'ease-out',
                fill: 'both'
            }
        }
    };

    dlg.classList.add('dialog');

    if (options.scrollX) {
        dlg.classList.add('scrollX');
        dlg.classList.add('smoothScrollX');

        if (layoutManager.tv) {
            centerFocus(dlg, true, true);
        }
    } else if (options.scrollY !== false) {
        dlg.classList.add('smoothScrollY');

        if (layoutManager.tv) {
            centerFocus(dlg, false, true);
        }
    }

    if (options.removeOnClose) {
        dlg.setAttribute('data-removeonclose', 'true');
    }

    if (options.size) {
        dlg.classList.add('dialog-fixedSize');
        dlg.classList.add(`dialog-${options.size}`);
    }

    if (enableAnimation()) {
        switch (dlg.animationConfig.entry.name) {
            case 'fadein':
                dlg.style.animation = `fadein ${entryAnimationDuration}ms ease-out normal`;
                break;
            case 'scaleup':
                dlg.style.animation = `scaleup ${entryAnimationDuration}ms ease-out normal both`;
                break;
            case 'slideup':
                dlg.style.animation = `slideup ${entryAnimationDuration}ms ease-out normal`;
                break;
            case 'slidedown':
                dlg.style.animation = `slidedown ${entryAnimationDuration}ms ease-out normal`;
                break;
            default:
                break;
        }
    }

    return dlg;
}

export function setOnOpen(val: ((dlg: HTMLElement) => void) | null): void {
    globalOnOpenCallback = val;
}

export default {
    open,
    close,
    createDialog,
    setOnOpen
};
interface DialogHistoryState {
    dialogs?: string[];
    [key: string]: unknown;
}
