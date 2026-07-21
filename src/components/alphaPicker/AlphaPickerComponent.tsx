import React, { FunctionComponent, useEffect, useRef } from 'react';

import AlphaPicker from './alphaPicker';

type AlphaPickerProps = {
    onAlphaPicked?: (e: Event) => void
};

// React compatibility wrapper component for alphaPicker.js
// eslint-disable-next-line no-empty-function
const AlphaPickerComponent: FunctionComponent<AlphaPickerProps> = ({ onAlphaPicked = () => {} }: AlphaPickerProps) => {
    const element = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const pickerElement = element.current;
        if (!pickerElement) {
            return undefined;
        }

        const alphaPicker = new AlphaPicker({
            element: pickerElement,
            mode: 'keyboard'
        });

        pickerElement.addEventListener('alphavalueclicked', onAlphaPicked);

        return () => {
            pickerElement.removeEventListener('alphavalueclicked', onAlphaPicked);
            alphaPicker.destroy();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Disabled for wrapper components
    }, []);

    return (
        <div
            ref={element}
            className='alphaPicker align-items-center'
        />
    );
};

export default AlphaPickerComponent;
