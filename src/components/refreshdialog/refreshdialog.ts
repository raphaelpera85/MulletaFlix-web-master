import dom from '../../utils/dom';
import dialogHelper from '../dialogHelper/dialogHelper';
import loading from '../loading/loading';
import layoutManager from '../layoutManager';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import '../../elements/emby-input/emby-input';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-select/emby-select';
import 'material-design-icons-iconfont';
import '../formdialog.scss';
import toast from '../toast/toast';

interface RefreshDialogOptions {
    serverId?: string;
    itemIds: string[];
    mode?: string;
}

function getEditorHtml(): string {
    let html = '';

    html += '<div class="formDialogContent smoothScrollY" style="padding-top:2em;">';
    html += '<div class="dialogContentInner dialog-content-centered">';
    html += '<form style="margin:auto;">';

    html += '<div class="fldSelectPlaylist selectContainer">';
    html += '<select is="emby-select" id="selectMetadataRefreshMode" label="' + globalize.translate('LabelRefreshMode') + '">';
    html += '<option value="scan" selected>' + globalize.translate('ScanForNewAndUpdatedFiles') + '</option>';
    html += '<option value="missing">' + globalize.translate('SearchForMissingMetadata') + '</option>';
    html += '<option value="all">' + globalize.translate('ReplaceAllMetadata') + '</option>';
    html += '</select>';
    html += '</div>';

    html += '<label class="checkboxContainer hide fldReplaceExistingImages">';
    html += '<input type="checkbox" is="emby-checkbox" class="chkReplaceImages" />';
    html += '<span>' + globalize.translate('ReplaceExistingImages') + '</span>';
    html += '</label>';

    html += '<label class="checkboxContainer hide fldReplaceTrickplayImages">';
    html += '<input type="checkbox" is="emby-checkbox" class="chkReplaceTrickplayImages" />';
    html += '<span>' + globalize.translate('ReplaceTrickplayImages') + '</span>';
    html += '</label>';

    html += '<div class="fieldDescription">';
    html += globalize.translate('RefreshDialogHelp');
    html += '</div>';

    html += '<input type="hidden" class="fldSelectedItemIds" />';

    html += '<br />';
    html += '<div class="formDialogFooter">';
    html += '<button is="emby-button" type="submit" class="raised btnSubmit block formDialogFooterItem button-submit">' + globalize.translate('Refresh') + '</button>';
    html += '</div>';

    html += '</form>';
    html += '</div>';
    html += '</div>';

    return html;
}

function centerFocus(elem: Element | null, horiz: boolean, on: boolean): void {
    import('../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        (scrollHelper.centerFocus as any)[fn](elem, horiz);
    });
}

function onSubmit(this: RefreshDialog, e: Event): void {
    loading.show();

    const instance = this;
    const dlg = dom.parentWithClass(e.target as HTMLElement, 'dialog')!;
    const options = instance.options;

    const apiClient = ServerConnections.getApiClient(options.serverId!) as any;

    const replaceAllMetadata = (dlg.querySelector('#selectMetadataRefreshMode') as HTMLSelectElement).value === 'all';

    const mode = (dlg.querySelector('#selectMetadataRefreshMode') as HTMLSelectElement).value === 'scan' ? 'Default' : 'FullRefresh';
    const replaceAllImages = mode === 'FullRefresh' && (dlg.querySelector('.chkReplaceImages') as HTMLInputElement).checked;
    const replaceTrickplayImages = mode === 'FullRefresh' && (dlg.querySelector('.chkReplaceTrickplayImages') as HTMLInputElement).checked;

    options.itemIds.forEach(function (itemId: string) {
        apiClient.refreshItem(itemId, {
            Recursive: true,
            ImageRefreshMode: mode,
            MetadataRefreshMode: mode,
            ReplaceAllImages: replaceAllImages,
            RegenerateTrickplay: replaceTrickplayImages,
            ReplaceAllMetadata: replaceAllMetadata
        });
    });

    dialogHelper.close(dlg);

    toast(globalize.translate('RefreshQueued'));

    loading.hide();

    e.preventDefault();
    return undefined as unknown as void;
}

class RefreshDialog {
    options: RefreshDialogOptions;

    constructor(options: RefreshDialogOptions) {
        this.options = options;
    }

    show(): Promise<void> {
        const dialogOptions: Record<string, any> = {
            removeOnClose: true,
            scrollY: false
        };

        if (layoutManager.tv) {
            dialogOptions.size = 'fullscreen';
        } else {
            dialogOptions.size = 'small';
        }

        const dlg = dialogHelper.createDialog(dialogOptions);

        dlg.classList.add('formDialog');

        let html = '';
        const title = globalize.translate('RefreshMetadata');

        html += '<div class="formDialogHeader">';
        html += `<button is="paper-icon-button-light" class="btnCancel autoSize" tabindex="-1" title="${globalize.translate('ButtonBack')}"><span class="material-icons arrow_back" aria-hidden="true"></span></button>`;
        html += '<h3 class="formDialogHeaderTitle">';
        html += title;
        html += '</h3>';

        html += '</div>';

        html += getEditorHtml();

        dlg.innerHTML = html;

        dlg.querySelector('form')!.addEventListener('submit', onSubmit.bind(this));

        const selectRefreshMode = dlg.querySelector('#selectMetadataRefreshMode') as HTMLSelectElement;
        selectRefreshMode.addEventListener('change', function (this: HTMLSelectElement) {
            if (this.value === 'scan') {
                dlg.querySelector('.fldReplaceExistingImages')!.classList.add('hide');
                dlg.querySelector('.fldReplaceTrickplayImages')!.classList.add('hide');
            } else {
                dlg.querySelector('.fldReplaceExistingImages')!.classList.remove('hide');
                dlg.querySelector('.fldReplaceTrickplayImages')!.classList.remove('hide');
            }
        });

        if (this.options.mode) {
            selectRefreshMode.value = this.options.mode;
        }

        selectRefreshMode.dispatchEvent(new CustomEvent('change'));

        dlg.querySelector('.btnCancel')!.addEventListener('click', function () {
            dialogHelper.close(dlg);
        });

        if (layoutManager.tv) {
            centerFocus(dlg.querySelector('.formDialogContent') as Element, false, true);
        }

        return new Promise(function (resolve: () => void) {
            if (layoutManager.tv) {
                centerFocus(dlg.querySelector('.formDialogContent') as Element, false, false);
            }

            dlg.addEventListener('close', resolve);
            dialogHelper.open(dlg);
        });
    }
}

export default RefreshDialog;
