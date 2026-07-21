import inputManager from './inputManager';
import focusManager from '../components/focusManager';
import browser from './browser';
import layoutManager from '../components/layoutManager';
import dom from '../utils/dom';
import Events from '../utils/events';

const self: Record<string, unknown> = {};

let lastMouseInputTime = new Date().getTime();
let isMouseIdle: boolean | undefined;

function mouseIdleTime(): number {
    return new Date().getTime() - lastMouseInputTime;
}

function notifyApp(): void {
    inputManager.notifyMouseMove();
}

function removeIdleClasses(): void {
    const classList = document.body.classList;

    classList.remove('mouseIdle');
    classList.remove('mouseIdle-tv');
}

function addIdleClasses(): void {
    const classList = document.body.classList;

    classList.add('mouseIdle');

    if (layoutManager.tv) {
        classList.add('mouseIdle-tv');
    }
}

export function showCursor(): void {
    if (isMouseIdle) {
        isMouseIdle = false;
        removeIdleClasses();
        Events.trigger(self, 'mouseactive');
    }
}

export function hideCursor(): void {
    if (!isMouseIdle) {
        isMouseIdle = true;
        addIdleClasses();
        Events.trigger(self, 'mouseidle');
    }
}

interface PointerMoveData {
    x: number;
    y: number;
}

let lastPointerMoveData: PointerMoveData | undefined;
function onPointerMove(e: PointerEvent | MouseEvent): void {
    const eventX = (e as PointerEvent).screenX || (e as MouseEvent).clientX;
    const eventY = (e as PointerEvent).screenY || (e as MouseEvent).clientY;

    // if coord don't exist how could it move
    if (typeof eventX === 'undefined' && typeof eventY === 'undefined') {
        return;
    }

    const obj = lastPointerMoveData;
    if (!obj) {
        lastPointerMoveData = {
            x: eventX as number,
            y: eventY as number
        };
        return;
    }

    // if coord are same, it didn't move
    if (Math.abs((eventX as number) - obj.x) < 10 && Math.abs((eventY as number) - obj.y) < 10) {
        return;
    }

    obj.x = eventX as number;
    obj.y = eventY as number;

    lastMouseInputTime = new Date().getTime();
    notifyApp();

    showCursor();
}

function onPointerEnter(e: PointerEvent | MouseEvent): void {
    const pointerType = (e as PointerEvent).pointerType || (layoutManager.mobile ? 'touch' : 'mouse');

    if (pointerType === 'mouse' && !isMouseIdle) {
        const parent = focusManager.focusableParent(e.target as Element);
        if (parent) {
            focusManager.focus(parent);
        }
    }
}

function enableFocusWithMouse(): boolean {
    if (!layoutManager.tv) {
        return false;
    }

    if (browser.web0s) {
        return false;
    }

    return !!browser.tv;
}

function onMouseInterval(): void {
    if (!isMouseIdle && mouseIdleTime() >= 5000) {
        hideCursor();
    }
}

let mouseInterval: ReturnType<typeof setInterval> | undefined;
function startMouseInterval(): void {
    if (!mouseInterval) {
        mouseInterval = setInterval(onMouseInterval, 5000);
    }
}

function stopMouseInterval(): void {
    const interval = mouseInterval;

    if (interval) {
        clearInterval(interval);
        mouseInterval = undefined;
    }

    removeIdleClasses();
}

function initMouse(): void {
    stopMouseInterval();

    /* eslint-disable-next-line compat/compat */
    dom.removeEventListener(document, (window.PointerEvent ? 'pointermove' : 'mousemove') as string, onPointerMove as EventListenerOrEventListenerObject, {
        passive: true
    });

    if (!layoutManager.mobile) {
        startMouseInterval();

        dom.addEventListener(document, (window.PointerEvent ? 'pointermove' : 'mousemove') as string, onPointerMove as EventListenerOrEventListenerObject, {
            passive: true
        });
    }

    /* eslint-disable-next-line compat/compat */
    dom.removeEventListener(document, (window.PointerEvent ? 'pointerenter' : 'mouseenter') as string, onPointerEnter as EventListenerOrEventListenerObject, {
        capture: true,
        passive: true
    });

    if (enableFocusWithMouse()) {
        dom.addEventListener(document, (window.PointerEvent ? 'pointerenter' : 'mouseenter') as string, onPointerEnter as EventListenerOrEventListenerObject, {
            capture: true,
            passive: true
        });
    }
}

initMouse();

Events.on(layoutManager, 'modechange', initMouse);

export default {
    hideCursor,
    showCursor
};
