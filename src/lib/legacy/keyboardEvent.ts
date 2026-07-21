/**
 * Polyfill for KeyboardEvent
 * - Constructor.
 * - 'code' property.
 * - 'key' property.
 */

interface KeyboardEventInit {
    bubbles?: boolean;
    cancelable?: boolean;
    view?: Window;
    keyCode?: number;
    charCode?: number;
    char?: string;
    which?: number;
    location?: number;
    keyLocation?: number;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
    repeat?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Window {
    KeyboardEvent: typeof globalThis.KeyboardEvent;
    Event: typeof globalThis.Event;
}

(function (window: Window & typeof globalThis) {
    'use strict';

    try {
        new window.KeyboardEvent('event', { bubbles: true, cancelable: true });
    } catch {
        // We can't use `KeyboardEvent` in old WebKit because `initKeyboardEvent`
        // doesn't seem to populate some properties (`keyCode`, `which`) that
        // are read-only.
        const KeyboardEventOriginal = window.Event;

        const KeyboardEventPolyfill = function (eventName: string, options?: KeyboardEventInit) {
            options = options || {};

            const event = new Event(eventName, { bubbles: !!options.bubbles, cancelable: !!options.cancelable });

            (event as unknown as Record<string, unknown>).view = options.view || document.defaultView;

            // Don't populate 'key' and 'code' with dummy values
            (event as unknown as Record<string, unknown>).keyCode = options.keyCode || 0;
            (event as unknown as Record<string, unknown>).charCode = options.charCode || 0;
            (event as unknown as Record<string, unknown>).char = options.char || '';
            (event as unknown as Record<string, unknown>).which = options.which || 0;

            (event as unknown as Record<string, unknown>).location = options.location || options.keyLocation || 0;

            (event as unknown as Record<string, unknown>).ctrlKey = !!options.ctrlKey;
            (event as unknown as Record<string, unknown>).altKey = !!options.altKey;
            (event as unknown as Record<string, unknown>).shiftKey = !!options.shiftKey;
            (event as unknown as Record<string, unknown>).metaKey = !!options.metaKey;

            (event as unknown as Record<string, unknown>).repeat = !!options.repeat;

            return event;
        } as unknown as typeof globalThis.KeyboardEvent;

        KeyboardEventPolyfill.prototype = KeyboardEventOriginal.prototype as unknown as typeof globalThis.KeyboardEvent.prototype;
        (window as unknown as Record<string, unknown>).KeyboardEvent = KeyboardEventPolyfill;
    }

    if (!('code' in KeyboardEvent.prototype)) {
        /**
         * Key code mapping.
         */
        const KeyCodes: Record<number, string> = {
            13: 'Enter',
            19: 'Pause',
            27: 'Escape',
            32: 'Space',
            33: 'PageUp',
            34: 'PageDown',
            35: 'End',
            36: 'Home',
            37: 'ArrowLeft',
            38: 'ArrowUp',
            39: 'ArrowRight',
            40: 'ArrowDown',
            45: 'Insert',
            46: 'Delete',
            110: 'NumpadDecimal',
            188: 'Comma',
            190: 'Period'
        };

        // Add [a..z]
        for (let i = 65; i <= 90; i++) {
            KeyCodes[i] = `Key${String.fromCharCode(i)}`;
        }

        // Add [0..9]
        for (let i = 48; i <= 57; i++) {
            KeyCodes[i] = `Digit${String.fromCharCode(i)}`;
        }

        // Add numpad [0..9]
        for (let i = 0; i <= 9; i++) {
            KeyCodes[i + 96] = `Numpad${i}`;
        }

        Object.defineProperty(KeyboardEvent.prototype, 'code', {
            get: function (this: globalThis.KeyboardEvent) {
                return KeyCodes[(this as unknown as Record<string, number>).keyCode] || '';
            },
            enumerable: true,
            configurable: true
        });
    }

    if (!('key' in KeyboardEvent.prototype)) {
        /**
         * Key mapping.
         */
        const Keys: Record<number, string | [string, string]> = {
            13: 'Enter',
            19: 'Pause',
            27: 'Escape',
            32: 'Space',
            33: 'PageUp',
            34: 'PageDown',
            35: 'End',
            36: 'Home',
            37: 'ArrowLeft',
            38: 'ArrowUp',
            39: 'ArrowRight',
            40: 'ArrowDown',
            45: 'Insert',
            46: 'Delete',
            48: ['0', ')'],
            49: ['1', '!'],
            50: ['2', '@'],
            51: ['3', '#'],
            52: ['4', '$'],
            53: ['5', '%'],
            54: ['6', '^'],
            55: ['7', '&'],
            56: ['8', '*'],
            57: ['9', '('],
            // Numpad+Shift is usually ignored or replaced with a direct key code (Insert, End, ArrowRight, ...)
            96: ['0', 'Insert'],
            97: ['1', 'End'],
            98: ['2', 'ArrowDown'],
            99: ['3', 'PageDown'],
            100: ['4', 'ArrowLeft'],
            101: ['5', ''],
            102: ['6', 'ArrowRight'],
            103: ['7', 'Home'],
            104: ['8', 'ArrowUp'],
            105: ['9', 'PageUp'],
            110: ['.', 'Delete'],
            188: [',', '<'],
            190: ['.', '>']
        };

        // Add [a..z]
        for (let i = 65; i <= 90; i++) {
            const c = String.fromCharCode(i);
            Keys[i] = [c.toLowerCase(), c.toUpperCase()];
        }

        Object.defineProperty(KeyboardEvent.prototype, 'key', {
            get: function (this: globalThis.KeyboardEvent) {
                const key = Keys[(this as unknown as Record<string, number>).keyCode] || '';
                return Array.isArray(key) ? key[+this.shiftKey] : key;
            },
            enumerable: true,
            configurable: true
        });
    }
}(window));
