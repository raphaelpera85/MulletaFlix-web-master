import React, { type FC } from 'react';

import globalize from 'lib/globalize';

type IProps = {
    name?: string;
    id?: string;
    required?: string;
    label?: string;
    children?: React.ReactNode;
};

const SelectElement: FC<IProps> = ({ name, id, required, label, children }) => (
    <select
        className='emby-select'
        name={name}
        id={id}
        required={required === 'required'}
        aria-label={label ? globalize.translate(label) : undefined}
    >
        {children}
    </select>
);

export default SelectElement;
