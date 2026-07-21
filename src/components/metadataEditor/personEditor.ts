import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';

import dialogHelper from '../dialogHelper/dialogHelper';
import layoutManager from '../layoutManager';
import globalize from '../../lib/globalize';
import '../../elements/emby-button/paper-icon-button-light';
import '../../elements/emby-input/emby-input';
import '../../elements/emby-select/emby-select';
import '../formdialog.scss';
import template from './personEditor.template.html';

interface Person {
    Name?: string;
    Type?: string;
    Role?: string;
    [key: string]: unknown;
}

function centerFocus(elem: Element | null, horiz: boolean, on: boolean): void {
    import('../../scripts/scrollHelper').then((scrollHelper) => {
        const fn = on ? 'on' : 'off';
        (scrollHelper as any).centerFocus[fn](elem, horiz);
    });
}

function show(person: Person): Promise<Person> {
    return new Promise(function (resolve, reject) {
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
        let submitted = false;

        html += globalize.translateHtml(template, 'core');

        dlg.innerHTML = html;

        (dlg.querySelector('.txtPersonName') as HTMLInputElement).value = person.Name || '';
        (dlg.querySelector('.selectPersonType') as HTMLSelectElement).value = person.Type || '';
        (dlg.querySelector('.txtPersonRole') as HTMLInputElement).value = person.Role || '';

        if (layoutManager.tv) {
            centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, true);
        }

        dialogHelper.open(dlg);

        dlg.addEventListener('close', function () {
            if (layoutManager.tv) {
                centerFocus(dlg.querySelector('.formDialogContent') as HTMLElement, false, false);
            }

            if (submitted) {
                resolve(person);
            } else {
                reject();
            }
        });

        let selectPersonTypeOptions = '';
        for (const type of Object.values(PersonKind)) {
            if (type === PersonKind.Unknown) {
                continue;
            }
            const selected = person.Type === type ? 'selected' : '';
            selectPersonTypeOptions += `<option value="${type}" ${selected}>\${${type}}</option>`;
        }
        (dlg.querySelector('.selectPersonType') as HTMLSelectElement).innerHTML = globalize.translateHtml(selectPersonTypeOptions);

        (dlg.querySelector('.selectPersonType') as HTMLSelectElement).addEventListener('change', function (this: HTMLSelectElement) {
            dlg.querySelector('.fldRole')?.classList.toggle(
                'hide',
                ![ PersonKind.Actor, PersonKind.GuestStar ].includes(this.value as any));
        });

        dlg.querySelector('.btnCancel')?.addEventListener('click', function () {
            dialogHelper.close(dlg);
        });

        dlg.querySelector('form')?.addEventListener('submit', function (e: Event) {
            submitted = true;

            person.Name = (dlg.querySelector('.txtPersonName') as HTMLInputElement).value;
            person.Type = (dlg.querySelector('.selectPersonType') as HTMLSelectElement).value;
            person.Role = (dlg.querySelector('.txtPersonRole') as HTMLInputElement).value || undefined;

            dialogHelper.close(dlg);

            e.preventDefault();
        });

        dlg.querySelector('.selectPersonType')?.dispatchEvent(new CustomEvent('change', {
            bubbles: true
        }));
    });
}

export default {
    show: show
};
