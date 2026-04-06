import * as Icon from '~/components/icon';
import { Button, ToggleGroup, ToggleGroupItem } from '~/components/ui';
import type { CalendarDisplayType } from './types';

const MONTHS = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
];

interface Props {
    month: number;
    year: number;
    type: CalendarDisplayType;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onToday: () => void;
    onTypeChange: (type: CalendarDisplayType) => void;
}

export const CalendarHeader = ({
    month,
    year,
    type,
    onPrevMonth,
    onNextMonth,
    onToday,
    onTypeChange
}: Props) => {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2.5">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-fg-default">
                    {MONTHS[month - 1]}
                </span>
                <span className="text-lg sm:text-xl font-medium text-fg-placeholder">
                    {year}
                </span>
            </div>
            <div className="flex items-center gap-3">
                <ToggleGroup
                    type="single"
                    variant="pills"
                    size="sm"
                    value={type}
                    onValueChange={(v) => v && onTypeChange(v as CalendarDisplayType)}>
                    <ToggleGroupItem value="create">Create date</ToggleGroupItem>
                    <ToggleGroupItem value="update">Update date</ToggleGroupItem>
                </ToggleGroup>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={onToday}>Today</Button>
                    <Button variant="ghost" size="icon-sm" onClick={onPrevMonth}>
                        <Icon.ChevronLeft width={18} height={18} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={onNextMonth}>
                        <Icon.ChevronRight width={18} height={18} />
                    </Button>
                </div>
            </div>
        </div>
    );
};
