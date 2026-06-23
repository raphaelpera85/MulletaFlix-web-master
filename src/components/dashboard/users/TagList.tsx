import React, { FunctionComponent, useCallback } from 'react';
import IconButton from '../../../elements/emby-button/IconButton';

type IProps = {
    tag?: string,
    tagType?: string;
    removeTagCallback?: (tag: string) => void;
};

const TagList: FunctionComponent<IProps> = ({ tag, tagType, removeTagCallback }: IProps) => {
    const onClick = useCallback(() => {
        tag !== undefined && removeTagCallback !== undefined && removeTagCallback(tag);
    }, [tag, removeTagCallback]);
    return (
        <div className='paperList'>
            <div className='listItem'>
                <div className='listItemBody'>
                    <h3 className='listItemBodyText'>
                        {tag}
                    </h3>
                </div>
                <IconButton
                    className={`${tagType} btnDeleteTag listItemButton`}
                    title='Delete'
                    icon='delete'
                    data-tag={tag}
                    onClick={onClick}
                />
            </div>
        </div>
    );
};

export default TagList;
