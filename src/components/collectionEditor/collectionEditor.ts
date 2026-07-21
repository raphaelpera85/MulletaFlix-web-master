import escapeHtml from 'escape-html';
import dom from '../../utils/dom';
import dialogHelper from '../dialogHelper/dialogHelper';
import loading from '../loading/loading';
import layoutManager from '../layoutManager';
import { appRouter } from '../router/appRouter';
import globalize from '../../lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-select/emby-select';
import 'material-design-icons-iconfont';
import '../formdialog.scss';
import '../../styles/flexstyles.scss';
import toast from '../toast/toast';

let currentServerId: string | null;

function onSubmit(this: HTMLElement, e: Event): void {
    loading.show();

    const panel = dom.parentWithClass(this, 'dialog')!;

    const collectionId = (panel.querySelector('#selectCollectionToAddTo') as HTMLSelectElement).value;

    const apiClient = ServerConnections.getApiClient(currentServerId!);

    if (collectionId) {
        addToCollection(apiClient, panel, collectionId);
    } else {
        createCollection(apiClient, panel);
    }

    e.preventDefault();
}

function createCollection(apiClient: any, dlg: HTMLElement): void {
    const url = apiClient.getUrl('Collections', {

        Name: (dlg.querySelector('#txtNewCollectionName') as HTMLInputElement).value,
        IsLocked: !(dlg.querySelector('#chkEnableInternetMetadata') as HTMLInputElement).checked,
        Ids: (dlg.querySelector('.fldSelectedItemIds') as HTMLInputElement).value || ''
    });

    apiClient.ajax({
        type: 'POST',
        url: url,
        dataType: 'json'

    }).then((result: any) => {
        loading.hide();

        const id = result.Id;

        (dlg as any).submitted = true;
        dialogHelper.close(dlg);
        redirectToCollection(apiClient, id);
    });
}

function redirectToCollection(apiClient: any, id: string): void {
    appRouter.showItem(id, apiClient.serverId());
}

function addToCollection(apiClient: any, dlg: HTMLElement, id: string): void {
    const url = apiClient.getUrl(`Collections/${id}/Items`, {

        Ids: (dlg.querySelector('.fldSelectedItemIds') as HTMLInputElement).value || ''
    });

    apiClient.ajax({
        type: 'POST',
        url: url

    }).then(() => {
        loading.hide();

        (dlg as any).submitted = true;
        dialogHelper.close(dlg);

        toast(globalize.translate('MessageItemsAdded'));
    });
}

function triggerChange(select: HTMLElement): void {
    select.dispatchEvent(new CustomEvent('change', {}));
}

function populateCollections(panel: HTMLElement): void {
    loading.show();

    const select = panel.querySelector('#selectCollectionToAddTo') as HTMLSelectElement;

    panel.querySelector('.newCollectionInfo')!.classList.add('hide');

    const options = {

        Recursive: true,
        IncludeItemTypes: 'BoxSet',
        SortBy: 'SortName',
        EnableTotalRecordCount: false
    };

    const apiClient: any = ServerConnections.getApiClient(currentServerId!);
    apiClient.getItems(apiClient.getCurrentUserId(), options).then((result: any) => {
        let html = '';

        html += `<option value="">${globalize.translate('OptionNew')}</option>`;

        html += result.Items.map((i: any) => {
            return `<option value="${i.Id}">${escapeHtml(i.Name)}</option>`;
        });

        select.innerHTML = html;
        select.value = '';
        triggerChange(select);

        loading.hide();
    });
}

function getEditorHtml(): string {
    let html = '';

    html += '<div class="formDialogContent smoothScrollY" style="padding-top:2em;">';
    html += '<div class="dialogContentInner dialog-content-centered">';
    html += '<form class="newCollectionForm" style="margin:auto;">';

    html += '<div>';
    html += globalize.translate('NewCollectionHelp');
    html += '</div>';

    html += '<div class="fldSelectCollection">';
    html += '<br/>';
    html += '<br/>';
    html += '<div class="selectContainer">';
    html += `<select is="emby-select" label="${globalize.translate('LabelCollection')}" id="selectCollectionToAddTo" autofocus></select>`;
    html += '</div>';
    html += '</div>';

    html += '<div class="newCollectionInfo">';

    html += '<div class="inputContainer">';
    html += `<input is="emby-input" type="text" id="txtNewCollectionName" required="required" label="${globalize.translate('LabelName')}" />`;
    html += `<div class="fieldDescription">${globalize.translate('NewCollectionNameExample')}</div>`;
    html += '</div>';

    html += '<label class="checkboxContainer">';
    html += '<input is="emby-checkbox" type="checkbox" id="chkEnableInternetMetadata" />';
    html += `<span>${globalize.translate('SearchForCollectionInternetMetadata')}</span>`;
    html += '</label>';

    // newCollectionInfo
    html += '</div>';

    html += '<div class="formDialogFooter">';
    html += `<button is="emby-button" type="submit" class="raised btnSubmit block formDialogFooterItem button-submit">${globalize.translate('ButtonOk')}</button>`;
    html += '</div>';

    html += '<input type="hidden" class="fldSelectedItemIds" />';

    html += '</form>';
    html += '</div>';
    html += '</div>';

    return html;
}

function initEditor(content: HTMLElement, items: string[]): void {
    content.querySelector('#selectCollectionToAddTo')!.addEventListener('change', function (this: HTMLSelectElement) {
        if (this.value) {
            content.querySelector('.newCollectionInfo')!.classList.add('hide');
            content.querySelector('#txtNewCollectionName')!.removeAttribute('required');
        } else {
            content.querySelector('.newCollectionInfo')!.classList.remove('hide');
            content.querySelector('#txtNewCollectionName')!.setAttribute('required', 'required');
        }
    });

    content.querySelector('form')!.addEventListener('submit', onSubmit.bind(content));

    (content.querySelector('.fldSelectedItemIds') as HTMLInputElement).value = items.join(',');

    if (items.length) {
        content.querySelector('.fldSelectCollection')!.classList.remove('hide');
        populateCollections(content);
    } else {
        content.querySelector('.fldSelectCollection')!.classList.add('hide');

        const selectCollectionToAddTo = content.querySelector('#selectCollectionToAddTo') as HTMLSelectElement;
        selectCollectionToAddTo.innerHTML = '';
        selectCollectionToAddTo.value = '';
        triggerChange(selectCollectionToAddTo);
    }
}

function centerFocus(elem: HTMLElement, horiz: boolean, on: boolean): void {
    import('../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        (scrollHelper.centerFocus as any)[fn](elem, horiz);
    });
}

class CollectionEditor {
    show(options: { items?: string[]; serverId: string }): Promise<void> {
        const items = options.items || [];
        currentServerId = options.serverId;

        const dialogOptions: any = {
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
        const title = items.length ? globalize.translate('HeaderAddToCollection') : globalize.translate('NewCollection');

        html += '<div class="formDialogHeader">';
        html += `<button is="paper-icon-button-light" class="btnCancel autoSize" tabindex="-1" title="${globalize.translate('ButtonBack')}"><span class="material-icons arrow_back" aria-hidden="true"></span></button>`;
        html += '<h3 class="formDialogHeaderTitle">';
        html += title;
        html += '</h3>';

        html += '</div>';

        html += getEditorHtml();

        dlg.innerHTML = html;

        initEditor(dlg, items);

        dlg.querySelector('.btnCancel')!.addEventListener('click', () => {
            dialogHelper.close(dlg);
        });

        if (layoutManager.tv) {
            centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, true);
        }

        return dialogHelper.open(dlg).then(() => {
            if (layoutManager.tv) {
                centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, false);
            }

            if ((dlg as any).submitted) {
                return Promise.resolve();
            }

            return Promise.reject();
        });
    }
}

export default CollectionEditor;
