import './viewManager/viewContainer.scss';
import Dashboard from '../utils/dashboard';

const getMainAnimatedPages = (): any => {
    return document.querySelector('.mainAnimatedPages');
};

function setControllerClass(view: any, options: any): Promise<void> {
    if (options.controllerFactory) {
        return Promise.resolve();
    }

    let controllerUrl = view.getAttribute('data-controller');

    if (controllerUrl) {
        if (controllerUrl.indexOf('__plugin/') === 0) {
            controllerUrl = controllerUrl.substring('__plugin/'.length);
        }

        controllerUrl = Dashboard.getPluginUrl(controllerUrl);
        const apiUrl = ApiClient.getUrl('/web/' + controllerUrl);
        return import(/* @vite-ignore */ apiUrl).then((ControllerFactory: any) => {
            options.controllerFactory = ControllerFactory;
        });
    }

    return Promise.resolve();
}

export function loadView(options: any): Promise<any> | void {
    if (options.cancel) {
        return;
    }

    const selected = selectedPageIndex;
    const previousAnimatable = selected === -1 ? null : allPages[selected];
    let pageIndex = selected + 1;

    if (pageIndex >= pageContainerCount) {
        pageIndex = 0;
    }

    const isPluginpage = options.url.includes('configurationpage');
    const newViewInfo: any = normalizeNewView(options, isPluginpage);
    const newView = newViewInfo.elem;
    const currentPage = allPages[pageIndex];

    if (currentPage) {
        triggerDestroy(currentPage);
    }

    let view: any = newView;

    if (typeof view == 'string') {
        view = document.createElement('div');
        view.innerHTML = newView;
    }

    view.classList.add('mainAnimatedPage');

    const mainAnimatedPages = getMainAnimatedPages();
    if (!mainAnimatedPages) {
        console.warn('[viewContainer] main animated pages element is not present');
        return;
    }

    const jq: any = (window as any).$;

    if (currentPage) {
        if (newViewInfo.hasScript && jq) {
            mainAnimatedPages.removeChild(currentPage);
            view = jq(view).appendTo(mainAnimatedPages)[0];
        } else {
            mainAnimatedPages.replaceChild(view, currentPage);
        }
    } else if (newViewInfo.hasScript && jq) {
        view = jq(view).appendTo(mainAnimatedPages)[0];
    } else {
        mainAnimatedPages.appendChild(view);
    }

    if (options.type) {
        view.setAttribute('data-type', options.type);
    }

    const properties: string[] = [];
    if (options.fullscreen) {
        properties.push('fullscreen');
    }

    if (properties.length) {
        view.setAttribute('data-properties', properties.join(','));
    }

    allPages[pageIndex] = view;

    return setControllerClass(view, options)
        .then(() => new Promise((resolve) => setTimeout(resolve, 0)))
        .then(() => {
            if (onBeforeChange) {
                onBeforeChange(view, false, options);
            }

            beforeAnimate(allPages, pageIndex, selected);
            selectedPageIndex = pageIndex;
            currentUrls[pageIndex] = options.url;

            if (!options.cancel && previousAnimatable) {
                afterAnimate(allPages, pageIndex);
            }

            if (jq) {
                jq.mobile = jq.mobile || {};
                jq.mobile.activePage = view;
            }

            return view;
        });
}

function parseHtml(html: string, hasScript: boolean): any {
    if (hasScript) {
        html = html
            .split('\x3c!--<script').join('<script')
            .split('</script>--\x3e').join('</script>');
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    return wrapper.querySelector('div[data-role="page"]');
}

function normalizeNewView(options: any, isPluginpage: boolean): any {
    const viewHtml = options.view;

    if (viewHtml.indexOf('data-role="page"') === -1) {
        return viewHtml;
    }

    let hasScript = viewHtml.indexOf('<script') !== -1;
    const elem: any = parseHtml(viewHtml, hasScript);

    if (hasScript) {
        hasScript = elem.querySelector('script') != null;
    }

    let hasjQuery = false;
    let hasjQuerySelect = false;
    let hasjQueryChecked = false;

    if (isPluginpage) {
        hasjQuery = viewHtml.indexOf('jQuery') !== -1 || viewHtml.indexOf('$(') !== -1 || viewHtml.indexOf('$.') !== -1;
        hasjQueryChecked = viewHtml.indexOf('.checked(') !== -1;
        hasjQuerySelect = viewHtml.indexOf('.selectmenu(') !== -1;
    }

    return {
        elem: elem,
        hasScript: hasScript,
        hasjQuerySelect: hasjQuerySelect,
        hasjQueryChecked: hasjQueryChecked,
        hasjQuery: hasjQuery
    };
}

function beforeAnimate(allPages: any[], newPageIndex: number, oldPageIndex: number): void {
    for (let index = 0, length = allPages.length; index < length; index++) {
        if (newPageIndex !== index && oldPageIndex !== index) {
            allPages[index].classList.add('hide');
        }
    }
}

function afterAnimate(allPages: any[], newPageIndex: number): void {
    for (let index = 0, length = allPages.length; index < length; index++) {
        if (newPageIndex !== index) {
            allPages[index].classList.add('hide');
        }
    }
}

export function setOnBeforeChange(fn: any): void {
    onBeforeChange = fn;
}

export function tryRestoreView(options: any): Promise<any> | void {
    console.debug('[viewContainer] tryRestoreView', options);
    const url = options.url;
    const index = currentUrls.indexOf(url);
    const jq: any = (window as any).$;

    if (index !== -1) {
        const animatable = allPages[index];
        const view = animatable;

        if (view) {
            if (options.cancel) {
                return;
            }

            const selected = selectedPageIndex;
            const previousAnimatable = selected === -1 ? null : allPages[selected];
            return setControllerClass(view, options).then(() => {
                if (onBeforeChange) {
                    onBeforeChange(view, true, options);
                }

                beforeAnimate(allPages, index, selected);
                animatable.classList.remove('hide');
                selectedPageIndex = index;

                if (!options.cancel && previousAnimatable) {
                    afterAnimate(allPages, index);
                }

                if (jq) {
                    jq.mobile = jq.mobile || {};
                    jq.mobile.activePage = view;
                }

                return view;
            });
        }
    }

    return Promise.reject();
}

function triggerDestroy(view: any): void {
    view.dispatchEvent(new CustomEvent('viewdestroy', {}));
}

export function reset(): void {
    console.debug('[viewContainer] resetting view cache');
    allPages = [];
    currentUrls = [];
    const mainAnimatedPages = getMainAnimatedPages();
    if (mainAnimatedPages) mainAnimatedPages.innerHTML = '';
    selectedPageIndex = -1;
}

let onBeforeChange: any;
let allPages: any[] = [];
let currentUrls: string[] = [];
const pageContainerCount = 3;
let selectedPageIndex = -1;
reset();
getMainAnimatedPages()?.classList.remove('hide');

export default {
    loadView,
    tryRestoreView,
    reset,
    setOnBeforeChange
};
