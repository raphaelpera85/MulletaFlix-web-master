import React, { type FC } from 'react';

import globalize from 'lib/globalize';

interface CheckBoxElementProps {
    labelClassName?: string;
    className?: string;
    elementId?: string;
    dataFilter?: string;
    itemType?: string;
    itemId?: string | null;
    itemCheckedAttribute?: string;
    itemName?: string | null;
    title?: string;
}

const CheckBoxElement: FC<CheckBoxElementProps> = ({
    labelClassName,
    className,
    elementId,
    dataFilter,
    itemType,
    itemId,
    itemCheckedAttribute,
    itemName,
    title
}) => (
    <div className='sectioncheckbox'>
        <label className={labelClassName}>
            <input
                type='checkbox'
                className={`emby-checkbox ${className ?? ''}`}
                id={elementId || undefined}
                data-filter={dataFilter || undefined}
                data-itemtype={itemType || undefined}
                data-id={itemId ?? undefined}
                defaultChecked={itemCheckedAttribute === 'checked'}
            />
            {itemName ? <span>{itemName}</span> : <span>{globalize.translate(title)}</span>}
        </label>
    </div>
);

export default CheckBoxElement;
