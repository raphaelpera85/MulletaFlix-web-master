import dialogHelper from '../dialogHelper/dialogHelper';
import layoutManager from '../layoutManager';
import globalize from '../../lib/globalize';
import * as userSettings from '../../scripts/settings/userSettings';
import '../../elements/emby-select/emby-select';
import '../../elements/emby-button/paper-icon-button-light';
import 'material-design-icons-iconfont';
import '../formdialog.scss';
import '../../elements/emby-button/emby-button';
import '../../styles/flexstyles.scss';
import template from './sortmenu.template.html';

interface SortOption {
    value: string;
    name: string;
}

interface SortSettings {
    sortOrder: string;
    sortBy: string;
}

interface SortMenuOptions {
    settingsKey: string;
    settings: SortSettings;
    sortOptions: SortOption[];
    onChange?: () => void;
    serverId?: string;
}

function onSubmit(e: SubmitEvent): false {
    e.preventDefault();
    return false;
}

function initEditor(context: HTMLElement, settings: SortSettings): void {
    const form = context.querySelector('form');
    if (form) {
        form.addEventListener('submit', onSubmit);
    }

    const selectSortOrder = context.querySelector<HTMLSelectElement>('.selectSortOrder');
    if (selectSortOrder) {
        selectSortOrder.value = settings.sortOrder;
    }

    const selectSortBy = context.querySelector<HTMLSelectElement>('.selectSortBy');
    if (selectSortBy) {
        selectSortBy.value = settings.sortBy;
    }
}

function centerFocus(elem: HTMLElement, horiz: boolean, on: boolean): void {
    import('../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        scrollHelper.centerFocus[fn](elem, horiz);
    });
}

function fillSortBy(context: HTMLElement, options: SortOption[]): void {
    const selectSortBy = context.querySelector<HTMLElement>('.selectSortBy');
    if (selectSortBy) {
        selectSortBy.innerHTML = options.map((option) => {
            return '<option value="' + option.value + '">' + option.name + '</option>';
        }).join('');
    }
}

function saveValues(context: HTMLElement, settingsKey: string): void {
    const selectSortOrder = context.querySelector<HTMLSelectElement>('.selectSortOrder');
    const selectSortBy = context.querySelector<HTMLSelectElement>('.selectSortBy');

    if (selectSortOrder) {
        userSettings.setFilter(settingsKey + '-sortorder', selectSortOrder.value);
    }
    if (selectSortBy) {
        userSettings.setFilter(settingsKey + '-sortby', selectSortBy.value);
    }
}

class SortMenu {
    show(options: SortMenuOptions): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const dialogOptions: { removeOnClose: true; scrollY: false; size?: string } = {
                removeOnClose: true,
                scrollY: false
            };

            dialogOptions.size = layoutManager.tv ? 'fullscreen' : 'small';

            const dlg = dialogHelper.createDialog(dialogOptions);

            dlg.classList.add('formDialog');

            let html = '';
            html += '<div class="formDialogHeader">';
            html += `<button is="paper-icon-button-light" class="btnCancel hide-mouse-idle-tv" tabindex="-1" title="${globalize.translate('ButtonBack')}"><span class="material-icons arrow_back" aria-hidden="true"></span></button>`;
            html += '<h3 class="formDialogHeaderTitle">${Sort}</h3>';
            html += '</div>';
            html += template;

            dlg.innerHTML = globalize.translateHtml(html, 'core');

            fillSortBy(dlg, options.sortOptions);
            initEditor(dlg, options.settings);

            const btnCancel = dlg.querySelector<HTMLButtonElement>('.btnCancel');
            if (btnCancel) {
                btnCancel.addEventListener('click', () => {
                    dialogHelper.close(dlg);
                });
            }

            if (layoutManager.tv) {
                const content = dlg.querySelector<HTMLElement>('.formDialogContent');
                if (content) {
                    centerFocus(content, false, true);
                }
            }

            let submitted = false;
            const form = dlg.querySelector('form');
            if (form) {
                form.addEventListener('change', () => {
                    submitted = true;
                }, true);
            }

            dialogHelper.open(dlg).then(() => {
                if (layoutManager.tv) {
                    const content = dlg.querySelector<HTMLElement>('.formDialogContent');
                    if (content) {
                        centerFocus(content, false, false);
                    }
                }

                if (submitted) {
                    saveValues(dlg, options.settingsKey);
                    resolve();
                    return;
                }

                reject();
            });
        });
    }
}

export default SortMenu;
