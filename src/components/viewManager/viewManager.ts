import viewContainer from '../viewContainer';
import focusManager from '../focusManager';
import layoutManager from '../layoutManager';

interface ViewEventDetail {
    detail: {
        type: string | null;
        properties: string[];
        params?: Record<string, string>;
        isRestored?: boolean;
        state?: unknown;
        options?: Record<string, unknown>;
    };
    bubbles: boolean;
    cancelable: boolean;
}

interface ViewOptions {
    cancel?: boolean;
    autoFocus?: boolean;
    state?: unknown;
    url?: string;
    options?: Record<string, unknown>;
    controllerFactory?: new (view: HTMLElement, params: Record<string, string>) => void | { default: new (view: HTMLElement, params: Record<string, string>) => void };
    [key: string]: unknown;
}

let currentView: (HTMLElement & { activeElement?: Element | null; initComplete?: boolean }) | null;
let dispatchPageEvents: boolean;

viewContainer.setOnBeforeChange(function (newView: HTMLElement & { initComplete?: boolean }, isRestored: boolean, options: ViewOptions) {
    const lastView = currentView;
    if (lastView) {
        const beforeHideResult = dispatchViewEvent(lastView, null, 'viewbeforehide', true);

        if (!beforeHideResult) {
            // todo: cancel
        }
    }

    const eventDetail = getViewEventDetail(newView, options, isRestored);

    if (!newView.initComplete) {
        newView.initComplete = true;

        if (typeof options.controllerFactory === 'function') {
            // eslint-disable-next-line new-cap
            new options.controllerFactory(newView, eventDetail.detail.params!);
        } else if (options.controllerFactory && typeof (options.controllerFactory as { default: unknown }).default === 'function') {
            new (options.controllerFactory as { default: new (view: HTMLElement, params: Record<string, string>) => void }).default(newView, eventDetail.detail.params!);
        }

        if (!options.controllerFactory || dispatchPageEvents) {
            dispatchViewEvent(newView, eventDetail, 'viewinit');
        }
    }

    dispatchViewEvent(newView, eventDetail, 'viewbeforeshow');
});

function onViewChange(view: HTMLElement, options: ViewOptions, isRestore?: boolean): void {
    const lastView = currentView;
    if (lastView) {
        dispatchViewEvent(lastView, null, 'viewhide');
    }

    currentView = view as HTMLElement & { activeElement?: Element | null; initComplete?: boolean };

    const eventDetail = getViewEventDetail(view, options, isRestore);

    if (!isRestore) {
        if (options.autoFocus !== false) {
            focusManager.autoFocus(view);
        }
    } else if (!layoutManager.mobile) {
        if ((view as HTMLElement & { activeElement?: Element }).activeElement && document.body.contains((view as HTMLElement & { activeElement?: Element }).activeElement!) && focusManager.isCurrentlyFocusable((view as HTMLElement & { activeElement?: Element }).activeElement!)) {
            focusManager.focus((view as HTMLElement & { activeElement?: Element }).activeElement!);
        } else {
            focusManager.autoFocus(view);
        }
    }

    view.dispatchEvent(new CustomEvent('viewshow', eventDetail));

    if (dispatchPageEvents) {
        view.dispatchEvent(new CustomEvent('pageshow', eventDetail));
    }
}

function getProperties(view: HTMLElement): string[] {
    const props = view.getAttribute('data-properties');

    if (props) {
        return props.split(',');
    }

    return [];
}

function dispatchViewEvent(view: HTMLElement, eventInfo: ViewEventDetail | null, eventName: string, isCancellable?: boolean): boolean {
    if (!eventInfo) {
        eventInfo = {
            detail: {
                type: view.getAttribute('data-type'),
                properties: getProperties(view)
            },
            bubbles: true,
            cancelable: !!isCancellable
        };
    }

    eventInfo.cancelable = isCancellable || false;

    const eventResult = view.dispatchEvent(new CustomEvent(eventName, eventInfo));

    if (dispatchPageEvents) {
        eventInfo.cancelable = false;
        view.dispatchEvent(new CustomEvent(eventName.replace('view', 'page'), eventInfo));
    }

    return eventResult;
}

function getViewEventDetail(view: HTMLElement, { state, url, options = {} }: ViewOptions, isRestored?: boolean): ViewEventDetail {
    const index = (url || '').indexOf('?');
    const searchParams = new URLSearchParams((url || '').substring(index + 1));
    const params: Record<string, string> = {};

    searchParams.forEach((value, key) => {
        params[key] = value;
    });

    return {
        detail: {
            type: view.getAttribute('data-type'),
            properties: getProperties(view),
            params,
            isRestored,
            state,
            // The route options
            options
        },
        bubbles: true,
        cancelable: false
    };
}

function resetCachedViews(): void {
    // Reset all cached views whenever the skin changes
    viewContainer.reset();
}

document.addEventListener('skinunload', resetCachedViews);

class ViewManager {
    loadView(options: ViewOptions): void {
        const lastView = currentView;

        // Record the element that has focus
        if (lastView) {
            lastView.activeElement = document.activeElement;
        }

        if (options.cancel) {
            return;
        }

        viewContainer.loadView(options)!.then(function (view: HTMLElement) {
            onViewChange(view, options);
        });
    }

    hideView(): void {
        if (currentView) {
            dispatchViewEvent(currentView, null, 'viewbeforehide');
            dispatchViewEvent(currentView, null, 'viewhide');
            currentView.classList.add('hide');
            currentView = null;
        }
    }

    tryRestoreView(options: ViewOptions, onViewChanging?: () => void): Promise<void> {
        if (options.cancel) {
            return Promise.reject({ cancelled: true });
        }

        // Record the element that has focus
        if (currentView) {
            currentView.activeElement = document.activeElement;
        }

        return viewContainer.tryRestoreView(options)!.then(function (view: HTMLElement) {
            if (onViewChanging) onViewChanging();
            onViewChange(view, options, true);
        });
    }

    getCurrentView(): HTMLElement | null {
        return currentView;
    }

    dispatchPageEvents(value: boolean): void {
        dispatchPageEvents = value;
    }
}

const viewManager = new ViewManager();
viewManager.dispatchPageEvents(true);

export default viewManager;
