(function () {
    const patch = (target: { createElement?: Function; [key: string]: unknown }) => {
        if (!target || !target.createElement) return;
        const original = target.createElement;
        if ((original as Function & { __patched?: boolean }).__patched) return;

        target.createElement = function (this: unknown, tagName: string, options?: ElementCreationOptions) {
            if (options && typeof options === 'object' && options.is) {
                return original.call(this, tagName, options.is);
            }
            return original.apply(this, arguments as unknown as unknown[]);
        };
        (target.createElement as Function & { __patched: boolean }).__patched = true;
    };

    const patchNS = (target: { createElementNS?: Function; [key: string]: unknown }) => {
        if (!target || !target.createElementNS) return;
        const original = target.createElementNS;
        if ((original as Function & { __patched?: boolean }).__patched) return;

        target.createElementNS = function (this: unknown, namespace: string, tagName: string, options?: ElementCreationOptions) {
            if (options && typeof options === 'object' && options.is) {
                return original.call(this, namespace, tagName, options.is);
            }
            return original.apply(this, arguments as unknown as unknown[]);
        };
        (target.createElementNS as Function & { __patched: boolean }).__patched = true;
    };

    if (typeof Document !== 'undefined') {
        patch(Document.prototype as unknown as Record<string, unknown>);
        patchNS(Document.prototype as unknown as Record<string, unknown>);
    }
    if (typeof HTMLDocument !== 'undefined') {
        patch(HTMLDocument.prototype as unknown as Record<string, unknown>);
        patchNS(HTMLDocument.prototype as unknown as Record<string, unknown>);
    }
    if (typeof document !== 'undefined') {
        patch(document as unknown as Record<string, unknown>);
        patchNS(document as unknown as Record<string, unknown>);
    }
})();

export {};
