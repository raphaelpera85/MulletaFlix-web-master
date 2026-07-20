import { FunctionComponent, memo, useEffect } from 'react';

import loading from './loading';

const Loading: FunctionComponent = () => {
    useEffect(() => {
        loading.show();

        return () => {
            loading.hide();
        };
    }, []);

    return null;
};

export default memo(Loading);
