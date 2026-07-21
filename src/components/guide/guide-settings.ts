import dialogHelper from '../dialogHelper/dialogHelper';
import globalize from '../../lib/globalize';
import * as userSettings from '../../scripts/settings/userSettings';
import layoutManager from '../layoutManager';
import scrollHelper from '../../scripts/scrollHelper';
import '../../elements/emby-checkbox/emby-checkbox';
import '../../elements/emby-radio/emby-radio';
import '../formdialog.scss';
import 'material-design-icons-iconfont';
import template from './guide-settings.template.html';

interface GuideSettingsOptions {
    categories?: string[];
}

interface GuideSettingsDialogOptions {
    removeOnClose?: boolean;
    scrollY?: boolean;
    size?: string;
}

function saveCategories(context: HTMLElement, options: GuideSettingsOptions): void {
    const categories: string[] = [];
    const chkCategories = context.querySelectorAll<HTMLInputElement>('.chkCategory');

    for (const chkCategory of chkCategories) {
        const type = chkCategory.getAttribute('data-type');

        if (type && chkCategory.checked) {
            categories.push(type);
        }
    }

    if (categories.length >= 4) {
        categories.push('series');
    }

    // differentiate between none and all
    categories.push('all');
    options.categories = categories;
}

function loadCategories(context: HTMLElement, options: GuideSettingsOptions): void {
    const selectedCategories = options.categories || [];
    const chkCategories = context.querySelectorAll<HTMLInputElement>('.chkCategory');

    for (const chkCategory of chkCategories) {
        const type = chkCategory.getAttribute('data-type');
        chkCategory.checked = !selectedCategories.length || (type ? selectedCategories.indexOf(type) !== -1 : false);
    }
}

function save(context: HTMLElement): void {
    const chkIndicators = context.querySelectorAll<HTMLInputElement>('.chkIndicator');

    for (const chkIndicator of chkIndicators) {
        const type = chkIndicator.getAttribute('data-type');
        if (type) {
            userSettings.set('guide-indicator-' + type, chkIndicator.checked);
        }
    }

    (context.querySelector<HTMLInputElement>('.chkColorCodedBackgrounds')!).checked = userSettings.get('guide-colorcodedbackgrounds') === 'true';
    (context.querySelector<HTMLInputElement>('.chkFavoriteChannelsAtTop')!).checked = userSettings.get('livetv-favoritechannelsattop') !== 'false';

    const sortBys = context.querySelectorAll<HTMLInputElement>('.chkSortOrder');
    for (const sortBy of sortBys) {
        if (sortBy.checked) {
            userSettings.set('livetv-channelorder', sortBy.value);
            break;
        }
    }
}

function load(context: HTMLElement): void {
    const chkIndicators = context.querySelectorAll<HTMLInputElement>('.chkIndicator');

    for (const chkIndicator of chkIndicators) {
        const type = chkIndicator.getAttribute('data-type');

        if (type) {
            if (chkIndicator.getAttribute('data-default') === 'true') {
                chkIndicator.checked = userSettings.get('guide-indicator-' + type) !== 'false';
            } else {
                chkIndicator.checked = userSettings.get('guide-indicator-' + type) === 'true';
            }
        }
    }

    (context.querySelector<HTMLInputElement>('.chkColorCodedBackgrounds')!).checked = userSettings.get('guide-colorcodedbackgrounds') === 'true';
    (context.querySelector<HTMLInputElement>('.chkFavoriteChannelsAtTop')!).checked = userSettings.get('livetv-favoritechannelsattop') !== 'false';

    const sortByValue = userSettings.get('livetv-channelorder') || 'Number';
    const sortBys = context.querySelectorAll<HTMLInputElement>('.chkSortOrder');

    for (const sortBy of sortBys) {
        sortBy.checked = sortBy.value === sortByValue;
    }
}

function showEditor(options: GuideSettingsOptions): Promise<void> {
    return new Promise(function (resolve, reject) {
        let settingsChanged = false;

        const dialogOptions: GuideSettingsDialogOptions = {
            removeOnClose: true,
            scrollY: false
        };

        if (layoutManager.tv) {
            dialogOptions.size = 'fullscreen';
        } else {
            dialogOptions.size = 'small';
        }

        const dlg = dialogHelper.createDialog(dialogOptions) as HTMLElement;

        dlg.classList.add('formDialog');
        dlg.innerHTML = globalize.translateHtml(template, 'core');

        dlg.addEventListener('change', function () {
            settingsChanged = true;
        });

        dlg.addEventListener('close', function () {
            if (layoutManager.tv) {
                const content = dlg.querySelector<HTMLElement>('.formDialogContent');
                if (content) {
                    scrollHelper.centerFocus.off(content, false);
                }
            }

            save(dlg);
            saveCategories(dlg, options);

            if (settingsChanged) {
                resolve();
            } else {
                reject();
            }
        });

        dlg.querySelector<HTMLButtonElement>('.btnCancel')?.addEventListener('click', function () {
            dialogHelper.close(dlg);
        });

        if (layoutManager.tv) {
            const content = dlg.querySelector<HTMLElement>('.formDialogContent');
            if (content) {
                scrollHelper.centerFocus.on(content, false);
            }
        }

        load(dlg);
        loadCategories(dlg, options);
        dialogHelper.open(dlg);
    });
}

export default {
    show: showEditor
};
