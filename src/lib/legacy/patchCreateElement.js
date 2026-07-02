(function () {
    const patch = (target) => {
        if (!target || !target.createElement) return;
        const original = target.createElement;
        if (original.__patched) return;

        target.createElement = function (tagName, options) {
            if (options && typeof options === 'object' && options.is) {
                // If options is an object, convert it to a string for the polyfill
                return original.call(this, tagName, options.is);
            }
            return original.apply(this, arguments);
        };
        target.createElement.__patched = true;
    };

    const patchNS = (target) => {
        if (!target || !target.createElementNS) return;
        const original = target.createElementNS;
        if (original.__patched) return;

        target.createElementNS = function (namespace, tagName, options) {
            if (options && typeof options === 'object' && options.is) {
                return original.call(this, namespace, tagName, options.is);
            }
            return original.apply(this, arguments);
        };
        target.createElementNS.__patched = true;
    };

    if (typeof Document !== 'undefined') {
        patch(Document.prototype);
        patchNS(Document.prototype);
    }
    if (typeof HTMLDocument !== 'undefined') {
        patch(HTMLDocument.prototype);
        patchNS(HTMLDocument.prototype);
    }
    if (typeof document !== 'undefined') {
        patch(document);
        patchNS(document);
    }
})();

export {};
