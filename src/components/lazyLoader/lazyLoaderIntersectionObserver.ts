interface LazyLoaderOptions {
    callback: (entry: IntersectionObserverEntry, observer: IntersectionObserver) => void;
    root?: Element | null;
}

export class LazyLoader {
    options: LazyLoaderOptions | null;
    observer: IntersectionObserver | null;

    constructor(options: LazyLoaderOptions) {
        this.options = options;
        this.observer = null;
    }

    createObserver(): void {
        const callback = this.options?.callback;
        const root = this.options?.root instanceof Element ? this.options.root : null;
        const isScrollerRoot = root?.classList.contains('emby-scroller') || root?.closest?.('.emby-scroller');

        if (!callback) {
            return;
        }

        const newObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach(entry => {
                    callback(entry, observer);
                });
            },
            {
                root,
                rootMargin: isScrollerRoot ? '1200px 2400px' : '2400px 0px',
                threshold: 0
            });

        this.observer = newObserver;
    }

    addElements(elements: HTMLCollectionOf<Element> | Element[]): void {
        let observer = this.observer;

        if (!observer) {
            this.createObserver();
            observer = this.observer;
        }

        if (!observer) {
            return;
        }

        Array.from(elements).forEach(element => {
            observer.observe(element);
        });
    }

    destroyObserver(): void {
        const observer = this.observer;

        if (observer) {
            observer.disconnect();
            this.observer = null;
        }
    }

    destroy(): void {
        this.destroyObserver();
        this.options = null;
    }
}

function unveilElements(elements: HTMLCollectionOf<Element> | Element[], root: Element | null | undefined, callback: LazyLoaderOptions['callback']): void {
    if (!elements.length) {
        return;
    }

    const lazyLoader = new LazyLoader({
        callback: callback,
        root: root?.closest?.('.emby-scroller') ?? null
    });
    lazyLoader.addElements(elements);
}

export function lazyChildren(elem: Element, callback: LazyLoaderOptions['callback']): void {
    unveilElements(elem.getElementsByClassName('lazy'), elem, callback);
}

export default {
    LazyLoader: LazyLoader,
    lazyChildren: lazyChildren
};
