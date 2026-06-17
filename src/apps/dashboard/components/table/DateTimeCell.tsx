import format from 'date-fns/format';
import isValid from 'date-fns/isValid';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';
import { FC } from 'react';

import { useLocale } from 'hooks/useLocale';

interface CellProps {
    cell: MRT_Cell<MRT_RowData>
}

const DateTimeCell: FC<CellProps> = ({ cell }) => {
    const { dateFnsLocale } = useLocale();
    const value = cell.getValue<Date | string | null | undefined>();
    let date: Date | null = null;

    if (value instanceof Date) {
        date = value;
    } else if (value) {
        date = new Date(value);
    }

    if (!date || !isValid(date)) {
        return null;
    }

    return format(date, 'Pp', { locale: dateFnsLocale });
};

export default DateTimeCell;
