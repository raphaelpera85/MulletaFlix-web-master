import escapeHtml from 'escape-html';
import dom from '../../utils/dom';
import dialogHelper from '../dialogHelper/dialogHelper';
import loading from '../loading/loading';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import actionsheet from '../actionSheet/actionSheet';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-button/emby-button';
import '../listview/listview.scss';
import 'material-design-icons-iconfont';
import '../formdialog.scss';

interface ChannelMapperOptions {
    serverId: string;
    providerId: string;
}

interface MappingOptions {
    ProviderName: string;
    ProviderChannels: Array<{
        Name: string;
        Id: string;
        [key: string]: any;
    }>;
    TunerChannels: Array<{
        Name: string;
        Id: string;
        ProviderChannelName?: string;
        ProviderChannelId: string;
        [key: string]: any;
    }>;
    [key: string]: any;
}

export default class ChannelMapper {
    private options: ChannelMapperOptions;
    private currentMappingOptions!: MappingOptions;

    show: () => Promise<void>;

    constructor(options: ChannelMapperOptions) {
        this.options = options;
        const self = this;

        function mapChannel(button: HTMLElement, channelId: string | null, providerChannelId: string | null): void {
            loading.show();
            const providerId = options.providerId;
            const apiClient: any = ServerConnections.getApiClient(options.serverId);
            apiClient.ajax({
                type: 'POST',
                url: (window as any).ApiClient.getUrl('LiveTv/ChannelMappings'),
                data: JSON.stringify({
                    providerId: providerId,
                    tunerChannelId: channelId,
                    providerChannelId: providerChannelId
                }),
                contentType: 'application/json',
                dataType: 'json'
            }).then((mapping: any) => {
                const listItem = dom.parentWithClass(button, 'listItem') as HTMLElement | null;
                button.setAttribute('data-providerid', mapping.ProviderChannelId);
                (listItem!.querySelector('.secondary') as HTMLElement)!.innerText = getMappingSecondaryName(mapping, self.currentMappingOptions.ProviderName);
                loading.hide();
            });
        }

        function onChannelsElementClick(e: Event): void {
            const btnMap = dom.parentWithClass(e.target as HTMLElement, 'btnMap') as HTMLElement | null;

            if (btnMap) {
                const channelId = btnMap.getAttribute('data-id');
                const providerChannelId = btnMap.getAttribute('data-providerid');
                const menuItems = self.currentMappingOptions.ProviderChannels.map((m: any) => {
                    return {
                        name: m.Name,
                        id: m.Id,
                        selected: m.Id.toLowerCase() === (providerChannelId || '').toLowerCase()
                    };
                }).sort((a: any, b: any) => {
                    return a.name.localeCompare(b.name);
                });
                actionsheet.show({
                    positionTo: btnMap,
                    items: menuItems
                }).then((newChannelId: unknown) => {
                    mapChannel(btnMap, channelId, newChannelId as string);
                });
            }
        }

        function getChannelMappingOptions(serverId: string, providerId: string): Promise<MappingOptions> {
            const apiClient: any = ServerConnections.getApiClient(serverId);
            return apiClient.getJSON(apiClient.getUrl('LiveTv/ChannelMappingOptions', {
                providerId: providerId
            }));
        }

        function getMappingSecondaryName(mapping: any, providerName: string): string {
            return `${mapping.ProviderChannelName || ''} - ${providerName}`;
        }

        function getTunerChannelHtml(channel: any, providerName: string): string {
            let html = '';
            html += '<div class="listItem">';
            html += '<span class="material-icons listItemIcon dvr" aria-hidden="true"></span>';
            html += '<div class="listItemBody two-line">';
            html += '<h3 class="listItemBodyText">';
            html += escapeHtml(channel.Name);
            html += '</h3>';
            html += '<div class="secondary listItemBodyText">';

            if (channel.ProviderChannelName) {
                html += escapeHtml(getMappingSecondaryName(channel, providerName));
            }

            html += '</div>';
            html += '</div>';
            html += `<button class="btnMap autoSize" is="paper-icon-button-light" type="button" data-id="${channel.Id}" data-providerid="${channel.ProviderChannelId}"><span class="material-icons mode_edit" aria-hidden="true"></span></button>`;
            html += '</div>';
            return html;
        }

        function getEditorHtml(): string {
            let html = '';
            html += '<div class="formDialogContent smoothScrollY">';
            html += '<div class="dialogContentInner dialog-content-centered">';
            html += '<form style="margin:auto;">';
            html += `<h1>${globalize.translate('Channels')}</h1>`;
            html += '<div class="channels paperList">';
            html += '</div>';
            html += '</form>';
            html += '</div>';
            html += '</div>';
            return html;
        }

        function initEditor(dlg: HTMLElement, initOptions: ChannelMapperOptions): void {
            getChannelMappingOptions(initOptions.serverId, initOptions.providerId).then(result => {
                self.currentMappingOptions = result;
                const channelsElement = dlg.querySelector('.channels')!;
                channelsElement.innerHTML = result.TunerChannels.map(channel => {
                    return getTunerChannelHtml(channel, result.ProviderName);
                }).join('');
                channelsElement.addEventListener('click', onChannelsElementClick);
            });
        }

        this.show = (): Promise<void> => {
            const dialogOptions: any = {
                removeOnClose: true
            };
            dialogOptions.size = 'small';
            const dlg = dialogHelper.createDialog(dialogOptions);
            dlg.classList.add('formDialog');
            dlg.classList.add('ui-body-a');
            dlg.classList.add('background-theme-a');
            let html = '';
            const title = globalize.translate('MapChannels');
            html += '<div class="formDialogHeader">';
            html += `<button is="paper-icon-button-light" class="btnCancel autoSize" tabindex="-1" title="${globalize.translate('ButtonBack')}"><span class="material-icons arrow_back" aria-hidden="true"></span></button>`;
            html += '<h3 class="formDialogHeaderTitle">';
            html += title;
            html += '</h3>';
            html += '</div>';
            html += getEditorHtml();
            dlg.innerHTML = html;
            initEditor(dlg, options);
            dlg.querySelector('.btnCancel')!.addEventListener('click', () => {
                dialogHelper.close(dlg);
            });
            return new Promise(resolve => {
                dlg.addEventListener('close', resolve as any);
                dialogHelper.open(dlg);
            });
        };
    }
}
