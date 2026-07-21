import Events from '../utils/events.ts';
import globalize from '../lib/globalize';
import loading from './loading/loading';
import appSettings from '../scripts/settings/appSettings';
import { playbackManager } from './playback/playbackmanager';
import { appHost } from '../components/apphost';
import { appRouter } from './router/appRouter';
import * as inputManager from '../scripts/inputManager';
import toast from '../components/toast/toast';
import confirm from '../components/confirm/confirm';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import * as dashboard from '../utils/dashboard';

const cacheParam = new Date().getTime();

const pluginModules = import.meta.glob([
    '../plugins/**/*.ts'
]);

class PluginManager {
    pluginsList: any[] = [];

    get plugins(): any[] {
        return this.pluginsList;
    }

    #loadStrings(plugin: any): Promise<any> {
        const strings = plugin.getTranslations ? plugin.getTranslations() : [];
        return globalize.loadStrings({
            name: plugin.id || plugin.packageName,
            strings: strings
        });
    }

    async #registerPlugin(plugin: any): Promise<any> {
        this.#register(plugin);

        if (plugin.type === 'skin') {
            return plugin;
        }

        return this.#loadStrings(plugin);
    }

    async #preparePlugin(pluginSpec: any, plugin: any): Promise<any> {
        if (typeof pluginSpec === 'string') {
            const existing = this.plugins.filter((p) => {
                return p.id === plugin.id;
            })[0];

            if (existing) {
                return pluginSpec;
            }

            plugin.installUrl = pluginSpec;

            const separatorIndex = Math.max(pluginSpec.lastIndexOf('/'), pluginSpec.lastIndexOf('\\'));
            plugin.baseUrl = pluginSpec.substring(0, separatorIndex);
        }

        return this.#registerPlugin(plugin);
    }

    async loadPlugin(pluginSpec: any): Promise<any> {
        let plugin: any;

        if (typeof pluginSpec === 'string') {
            const win = window as any;
            if (pluginSpec in win) {
                console.debug(`Loading plugin (via window): ${pluginSpec}`);

                const pluginDefinition = await win[pluginSpec];
                if (typeof pluginDefinition !== 'function') {
                    throw new TypeError('Plugin definitions in window have to be an (async) function returning the plugin class');
                }

                const PluginClass = await pluginDefinition();
                if (typeof PluginClass !== 'function') {
                    throw new TypeError(`Plugin definition doesn't return a class for '${pluginSpec}'`);
                }

                plugin = new PluginClass({
                    events: Events,
                    loading,
                    appSettings,
                    playbackManager,
                    globalize,
                    appHost,
                    appRouter,
                    inputManager,
                    toast,
                    confirm,
                    dashboard,
                    ServerConnections
                });
            } else {
                console.debug(`Loading plugin (via dynamic import): ${pluginSpec}`);
                const normalizedPluginSpec = pluginSpec.endsWith('.js')
                    ? pluginSpec.slice(0, -3) + '.ts'
                    : pluginSpec;
                const globPath = `../plugins/${normalizedPluginSpec}`;
                const loadFn = pluginModules[globPath] || pluginModules[`${globPath}.ts`];
                if (!loadFn) {
                    throw new Error(`Plugin not found in glob: ${normalizedPluginSpec}`);
                }
                const pluginResult: any = await loadFn();
                plugin = new pluginResult.default();
            }
        } else if (pluginSpec && typeof pluginSpec.then === 'function') {
            console.debug('Loading plugin (via promise/async function)');

            const pluginResult: any = await pluginSpec;
            plugin = new pluginResult.default();
        } else {
            throw new TypeError('Plugins have to be a Promise that resolves to a plugin builder function');
        }

        return this.#preparePlugin(pluginSpec, plugin);
    }

    #register(obj: any): void {
        this.pluginsList.push(obj);
        Events.trigger(this, 'registered', [obj]);
    }

    ofType(type: string): any[] {
        return this.pluginsList.filter((plugin) => plugin.type === type);
    }

    firstOfType(type: string): any {
        return this.ofType(type)
            .sort((p1, p2) => (p1.priority || 0) - (p2.priority || 0))[0];
    }

    mapPath(plugin: any, path: string, addCacheParam?: boolean): string {
        if (typeof plugin === 'string') {
            plugin = this.pluginsList.filter((p) => {
                return (p.id || p.packageName) === plugin;
            })[0];
        }

        let url = plugin.baseUrl + '/' + path;

        if (addCacheParam) {
            url += url.includes('?') ? '&' : '?';
            url += 'v=' + (plugin.version || cacheParam);
        }

        return url;
    }
}

export const pluginManager = new PluginManager();
