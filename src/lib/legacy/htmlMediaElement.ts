/**
 * Polyfill for HTMLMediaElement
 * - HTMLMediaElement.play
 *   Return a `Promise`.
 */

(function (HTMLMediaElement: typeof window.HTMLMediaElement) {
    'use strict';

    const HTMLMediaElementPrototype = HTMLMediaElement.prototype;
    const realPlay = HTMLMediaElementPrototype.play;

    HTMLMediaElementPrototype.play = function () {
        // eslint-disable-next-line sonarjs/no-try-promise
        try {
            const promise = realPlay.apply(this, arguments as unknown as []);

            if (typeof promise?.then === 'function') {
                return promise;
            }

            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    };
}(HTMLMediaElement));
