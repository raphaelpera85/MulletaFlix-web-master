// Polyfill to add support for preventScroll by focus function

if ((HTMLElement.prototype as unknown as Record<string, unknown>).nativeFocus === undefined) {
    (function () {
        let supportsPreventScrollOption = false;
        try {
            const focusElem = document.createElement('div');

            focusElem.addEventListener('focus', function(event: FocusEvent) {
                event.preventDefault();
                event.stopPropagation();
            }, true);

            const opts = Object.defineProperty({}, 'preventScroll', {
                get: function () {
                    supportsPreventScrollOption = true;
                    return null;
                }
            });

            focusElem.focus(opts);
        } catch {
            // no preventScroll supported
        }

        if (!supportsPreventScrollOption) {
            (HTMLElement.prototype as unknown as Record<string, unknown>).nativeFocus = HTMLElement.prototype.focus;

            HTMLElement.prototype.focus = function(options?: FocusOptions & { preventScroll?: boolean }) {
                const scrollX = window.scrollX;
                const scrollY = window.scrollY;

                ((this as unknown as Record<string, unknown>).nativeFocus as (options?: FocusOptions) => void)();

                // Restore window scroll if preventScroll
                if (options?.preventScroll) {
                    window.scroll(scrollX, scrollY);
                }
            };
        }
    })();
}
