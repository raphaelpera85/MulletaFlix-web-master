import React, { FunctionComponent } from 'react';
import IconButton from './emby-button/IconButton';

type IProps = {
    SectionClassName?: string;
    title?: string;
    isBtnVisible?: boolean;
    btnId?: string;
    btnClassName?: string;
    btnTitle?: string;
    btnIcon?: string;
};
const SectionTitleContainer: FunctionComponent<IProps> = ({ SectionClassName, title, isBtnVisible = false, btnId, btnClassName, btnTitle, btnIcon }: IProps) => {
    return (
        <div className={`${SectionClassName} sectionTitleContainer flex align-items-center`}>
            <h2 className='sectionTitle'>
                {title}
            </h2>

            {isBtnVisible && <IconButton
                id={btnId}
                className={btnClassName}
                title={btnTitle}
                icon={btnIcon}
            />}

        </div>
    );
};

export default SectionTitleContainer;
