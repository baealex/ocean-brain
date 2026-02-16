import * as Icon from '~/components/icon';
import { Button } from '~/components/ui';

const MONTHS = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
];

interface Props {
    month: number;
    year: number;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onToday: () => void;
}

export const CalendarHeader = ({
    month,
    year,
    onPrevMonth,
    onNextMonth,
    onToday
}: Props) => {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold">
                    {MONTHS[month - 1]}
                </h1>
                <span className="text-xl sm:text-2xl text-fg-placeholder">
                    {year}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onToday}>
                    Today
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={onPrevMonth}>
                    <Icon.ChevronLeft width={18} height={18} />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={onNextMonth}>
                    <Icon.ChevronRight width={18} height={18} />
                </Button>
            </div>
        </div>
    );
};
