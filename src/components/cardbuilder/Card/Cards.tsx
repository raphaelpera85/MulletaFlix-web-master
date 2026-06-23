import React, { type FC, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { setCardData } from '../cardBuilder';
import Card from './Card';
import type { ItemDto } from 'types/base/models/item-dto';
import type { CardOptions } from 'types/cardOptions';
import '../card.scss';

interface CardsProps {
    items: ItemDto[];
    cardOptions: CardOptions & { virtualize?: boolean; virtualizeEstimateSize?: number };
}

const Cards: FC<CardsProps> = ({ items, cardOptions }) => {
    const parentRef = useRef<HTMLDivElement>(null);

    setCardData(items, cardOptions);

    const shouldVirtualize = cardOptions.virtualize && items.length > 50;

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => cardOptions.virtualizeEstimateSize ?? 250, [cardOptions.virtualizeEstimateSize]),
        overscan: 5
    });

    if (!shouldVirtualize) {
        return (
            <>
                {items.map((item) => (
                    <Card key={item.Id} item={item} cardOptions={cardOptions} />
                ))}
            </>
        );
    }

    return (
        <div
            ref={parentRef}
            style={{ height: '100%', overflow: 'auto', contain: 'strict' }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative'
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                        key={items[virtualRow.index].Id}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`
                        }}
                    >
                        <Card
                            item={items[virtualRow.index]}
                            cardOptions={cardOptions}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Cards;
