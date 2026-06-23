import React, { FunctionComponent, useCallback } from 'react';
import datetime from '../../../scripts/datetime';
import globalize from '../../../lib/globalize';
import IconButton from '../../../elements/emby-button/IconButton';

type AccessScheduleListProps = {
    index?: number;
    DayOfWeek?: string;
    StartHour?: number ;
    EndHour?: number;
    removeScheduleCallback?: (index: number) => void;
};

function getDisplayTime(hours = 0) {
    let minutes = 0;
    const pct = hours % 1;

    if (pct) {
        minutes = Math.floor(60 * pct);
    }

    return datetime.getDisplayTime(new Date(2000, 1, 1, hours, minutes, 0, 0));
}

const AccessScheduleList: FunctionComponent<AccessScheduleListProps> = ({ index, DayOfWeek, StartHour, EndHour, removeScheduleCallback }: AccessScheduleListProps) => {
    const onClick = useCallback(() => {
        index !== undefined && removeScheduleCallback !== undefined && removeScheduleCallback(index);
    }, [index, removeScheduleCallback]);
    return (
        <div
            className='liSchedule listItem'
            data-day={ DayOfWeek}
            data-start={ StartHour}
            data-end={ EndHour}
        >
            <div className='listItemBody two-line'>
                <h3 className='listItemBodyText'>
                    {globalize.translate(DayOfWeek)}
                </h3>
                <div className='listItemBodyText secondary'>
                    {getDisplayTime(StartHour) + ' - ' + getDisplayTime(EndHour)}
                </div>
            </div>
            <IconButton
                className='btnDelete listItemButton'
                title='Delete'
                icon='delete'
                data-index={index}
                onClick={onClick}
            />
        </div>
    );
};

export default AccessScheduleList;
