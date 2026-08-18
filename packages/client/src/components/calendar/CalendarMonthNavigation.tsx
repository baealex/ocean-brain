import * as Icon from '~/components/icon';
import { Button } from '~/components/ui';

interface CalendarMonthNavigationProps {
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onToday: () => void;
}

export const CalendarMonthNavigation = ({ onPrevMonth, onNextMonth, onToday }: CalendarMonthNavigationProps) => (
    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <Button type="button" variant="ghost" size="sm" className="min-h-11 px-4 sm:min-h-8 sm:px-3" onClick={onToday}>
            Today
        </Button>
        <div className="flex items-center gap-1.5" role="group" aria-label="Month navigation">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9"
                aria-label="Previous month"
                onClick={onPrevMonth}
            >
                <Icon.ChevronLeft width={18} height={18} />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9"
                aria-label="Next month"
                onClick={onNextMonth}
            >
                <Icon.ChevronRight width={18} height={18} />
            </Button>
        </div>
    </div>
);
