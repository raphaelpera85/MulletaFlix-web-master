// Polyfill for vendor prefixed style properties

(function () {
    const vendorProperties: Record<string, string[]> = {
        'transform': ['webkitTransform'],
        'transition': ['webkitTransition']
    };

    const elem = document.createElement('div');

    function polyfillProperty(name: string): void {
        if (!(name in elem.style)) {
            (vendorProperties[name] || []).every((vendorName: string) => {
                if (vendorName in elem.style) {
                    console.debug(`polyfill '${name}' with '${vendorName}'`);

                    Object.defineProperty(CSSStyleDeclaration.prototype, name, {
                        get: function (this: Record<string, string>) { return this[vendorName]; },
                        set: function (this: Record<string, string>, val: string) { this[vendorName] = val; }
                    });

                    return false;
                }

                return true;
            });
        }
    }

    if (elem.style instanceof CSSStyleDeclaration) {
        polyfillProperty('transform');
        polyfillProperty('transition');
    }
})();
