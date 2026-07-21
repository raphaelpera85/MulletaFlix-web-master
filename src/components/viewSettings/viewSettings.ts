import dialogHelper from '../dialogHelper/dialogHelper';
import layoutManager from '../layoutManager';
import globalize from '../../lib/globalize';
import * as userSettings from '../../scripts/settings/userSettings';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-button/emby-button';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-select/emby-select';
import 'material-design-icons-iconfont';
import '../formdialog.scss';
import '../../styles/flexstyles.scss';
import template from './viewSettings.template.html';

interface ViewSettingsOptions {
    visibleSettings: string[];
    settings: Record<string, unknown>;
    settingsKey: string;
    [key: string]: unknown;
}

function onSubmit(e: Event): void {
    e.preventDefault();
}

function initEditor(context: HTMLElement, settings: Record<string, unknown>): void {
    context.querySelector('form')?.addEventListener('submit', onSubmit);

    const elems = context.querySelectorAll('.viewSetting-checkboxContainer');

    for (const elem of elems) {
        const checkbox = elem.querySelector('input') as HTMLInputElement;
        const settingName = elem.getAttribute('data-settingname');
        checkbox.checked = settings[settingName || ''] as boolean || false;
    }

    (context.querySelector('.selectImageType') as HTMLSelectElement).value = (settings.imageType as string) || 'primary';
}

function saveValues(context: HTMLElement, settings: Record<string, unknown>, settingsKey: string): void {
    const elems = context.querySelectorAll('.viewSetting-checkboxContainer');
    for (const elem of elems) {
        const settingName = elem.getAttribute('data-settingname');
        userSettings.set(settingsKey + '-' + settingName, (elem.querySelector('input') as HTMLInputElement).checked);
    }

    userSettings.set(settingsKey + '-imageType', (context.querySelector('.selectImageType') as HTMLSelectElement).value);
}

function centerFocus(elem: HTMLElement | null, horiz: boolean, on: boolean): void {
    import('../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        if (elem) {
            scrollHelper.centerFocus[fn](elem, horiz);
        }
    });
}

function showIfAllowed(context: HTMLElement, selector: string, visible: boolean): void {
    const elem = context.querySelector(selector);

    if (!elem) return;

    if (visible && !elem.classList.contains('hiddenFromViewSettings')) {
        elem.classList.remove('hide');
    } else {
        elem.classList.add('hide');
    }
}

class ViewSettings {
    show(options: ViewSettingsOptions): Promise<void> {
        return new Promise(function (resolve) {
            const dialogOptions = {
                removeOnClose: true,
                scrollY: false,
                size: '' as string
            };

            if (layoutManager.tv) {
                dialogOptions.size = 'fullscreen';
            } else {
                dialogOptions.size = 'small';
            }

            const dlg = dialogHelper.createDialog(dialogOptions);

            dlg.classList.add('formDialog');

            let html = '';

            html += '<div class="formDialogHeader">';
            html += `<button is="paper-icon-button-light" class="btnCancel hide-mouse-idle-tv" tabindex="-1" title="${globalize.translate('ButtonBack')}"><span class="material-icons arrow_back" aria-hidden="true"></span></button>`;
            html += '<h3 class="formDialogHeaderTitle">${Settings}</h3>';

            html += '</div>';

            html += template;

            dlg.innerHTML = globalize.translateHtml(html, 'core');

            const settingElements = dlg.querySelectorAll('.viewSetting');
            for (const settingElement of settingElements) {
                if (options.visibleSettings.indexOf(settingElement.getAttribute('data-settingname') || '') === -1) {
                    settingElement.classList.add('hide');
                    settingElement.classList.add('hiddenFromViewSettings');
                } else {
                    settingElement.classList.remove('hide');
                    settingElement.classList.remove('hiddenFromViewSettings');
                }
            }

            initEditor(dlg, options.settings);

            dlg.querySelector('.selectImageType')?.addEventListener('change', function (this: HTMLSelectElement) {
                showIfAllowed(dlg, '.chkTitleContainer', this.value !== 'list' && this.value !== 'banner');
                showIfAllowed(dlg, '.chkYearContainer', this.value !== 'list' && this.value !== 'banner');
            });

            dlg.querySelector('.btnCancel')?.addEventListener('click', function () {
                dialogHelper.close(dlg);
            });

            if (layoutManager.tv) {
                centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, true);
            }

            let submitted: boolean;

            dlg.querySelector('.selectImageType')?.dispatchEvent(new CustomEvent('change', {}));

            dlg.querySelector('form')?.addEventListener('change', function () {
                submitted = true;
            }, true);

            dialogHelper.open(dlg).then(function () {
                if (layoutManager.tv) {
                    centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, false);
                }

                if (submitted!) {
                    saveValues(dlg, options.settings, options.settingsKey);
                    return resolve();
                }

                return resolve();
            });
        });
    }
}

export default ViewSettings;
