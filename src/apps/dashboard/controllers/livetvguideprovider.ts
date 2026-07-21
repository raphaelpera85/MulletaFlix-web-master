import loading from 'components/loading/loading';
import globalize from 'lib/globalize';
import Dashboard, { pageIdOn } from 'utils/dashboard';
import { getParameterByName } from 'utils/url';
import Events from 'utils/events';

interface ProviderInstance {
    init(): void;
}

interface ProviderFactory {
    new (page: HTMLElement, providerId: string | null, options: Record<string, never>): ProviderInstance;
}

function onListingsSubmitted(): void {
    Dashboard.navigate('dashboard/livetv');
}

function init(page: HTMLElement, type: string, providerId: string | null): void {
    import(`components/tvproviders/${type}`).then(({ default: ProviderFactoryClass }) => {
        const Provider = ProviderFactoryClass as ProviderFactory;
        const instance = new Provider(page, providerId, {});
        Events.on(instance, 'submitted', onListingsSubmitted);
        instance.init();
    });
}

function loadTemplate(page: HTMLElement, type: string, providerId: string | null): void {
    import(`components/tvproviders/${type}.template.html`).then(({ default: html }) => {
        const template = page.querySelector<HTMLElement>('.providerTemplate');
        if (template) {
            template.innerHTML = globalize.translateHtml(html);
        }
        init(page, type, providerId);
    });
}

pageIdOn('pageshow', 'liveTvGuideProviderPage', function (this: HTMLElement) {
    loading.show();
    const providerId = getParameterByName('id');
    const type = getParameterByName('type');
    if (type) {
        loadTemplate(this, type, providerId);
    }
});
