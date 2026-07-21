/**
 * Module for controlling user parental control from.
 * @module components/accessSchedule/accessSchedule
 */

import dialogHelper from '../dialogHelper/dialogHelper';
import datetime from '../../scripts/datetime';
import globalize from '../../lib/globalize';
import '../../elements/emby-select/emby-select';
import '../../elements/emby-button/paper-icon-button-light';
import '../formdialog.scss';
import template from './accessSchedule.template.html';

interface AccessScheduleOptions {
    schedule: {
        DayOfWeek?: string;
        StartHour?: number;
        EndHour?: number;
        [key: string]: any;
    };
}

function getDisplayTime(hours: number): string {
    let minutes = 0;
    const pct = hours % 1;

    if (pct) {
        minutes = parseInt(String(60 * pct), 10);
    }

    return datetime.getDisplayTime(new Date(2000, 1, 1, hours, minutes, 0, 0));
}

function populateHours(context: HTMLElement): void {
    let html = '';

    for (let i = 0; i < 24; i += 0.5) {
        html += `<option value="${i}">${getDisplayTime(i)}</option>`;
    }

    html += `<option value="24">${getDisplayTime(0)}</option>`;
    (context.querySelector('#selectStart') as HTMLSelectElement).innerHTML = html;
    (context.querySelector('#selectEnd') as HTMLSelectElement).innerHTML = html;
}

function loadSchedule(context: HTMLElement, { DayOfWeek, StartHour, EndHour }: AccessScheduleOptions['schedule']): void {
    (context.querySelector('#selectDay') as HTMLSelectElement).value = DayOfWeek || 'Sunday';
    (context.querySelector('#selectStart') as HTMLSelectElement).value = String(StartHour || 0);
    (context.querySelector('#selectEnd') as HTMLSelectElement).value = String(EndHour || 0);
}

function submitSchedule(context: HTMLDivElement, options: AccessScheduleOptions): void {
    const updatedSchedule = {
        DayOfWeek: (context.querySelector('#selectDay') as HTMLSelectElement).value,
        StartHour: (context.querySelector('#selectStart') as HTMLSelectElement).value,
        EndHour: (context.querySelector('#selectEnd') as HTMLSelectElement).value
    };

    if (parseFloat(updatedSchedule.StartHour) >= parseFloat(updatedSchedule.EndHour)) {
        alert(globalize.translate('ErrorStartHourGreaterThanEnd'));
        return;
    }

    (context as any).submitted = true;
    options.schedule = Object.assign(options.schedule, updatedSchedule);
    dialogHelper.close(context);
}

export function show(options: AccessScheduleOptions): Promise<AccessScheduleOptions['schedule']> {
    return new Promise((resolve, reject) => {
        const dlg = dialogHelper.createDialog({
            removeOnClose: true,
            size: 'small'
        });
        dlg.classList.add('formDialog');
        let html = '';
        html += globalize.translateHtml(template);
        dlg.innerHTML = html;
        populateHours(dlg);
        loadSchedule(dlg, options.schedule);
        dialogHelper.open(dlg);
        dlg.addEventListener('close', () => {
            if ((dlg as any).submitted) {
                resolve(options.schedule);
            } else {
                reject();
            }
        });
        dlg.querySelector('.btnCancel')!.addEventListener('click', () => {
            dialogHelper.close(dlg);
        });
        dlg.querySelector('form')!.addEventListener('submit', (event: Event) => {
            submitSchedule(dlg, options);
            event.preventDefault();
            return false;
        });
    });
}

export default {
    show: show
};
