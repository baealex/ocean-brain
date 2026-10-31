import classNames from 'classnames';

import * as Icon from '~/components/icon';
import { Button } from '~/components/ui';

interface CalendarMonthNavigationProps {
    className?: string;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onToday: () => void;
}

export const CalendarMonthNavigation = ({
    className,
    onPrevMonth,
    onNextMonth,
    onToday,
}: CalendarMonthNavigationProps) => (
    <div className={classNames('flex shrink-0 items-center gap-1.5', className)}>
        <Button type="button" variant="subtle" size="sm" className="min-h-10 px-3 sm:min-h-8" onClick={onToday}>
            Today
        </Button>
        <div className="flex items-center gap-1" role="group" aria-label="Month navigation">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-10 min-w-10 sm:min-h-9 sm:min-w-9"
                aria-label="Previous month"
                onClick={onPrevMonth}
            >
                <Icon.ChevronLeft width={18} height={18} />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-10 min-w-10 sm:min-h-9 sm:min-w-9"
                aria-label="Next month"
                onClick={onNextMonth}
            >
                <Icon.ChevronRight width={18} height={18} />
            </Button>
        </div>
    </div>
);
