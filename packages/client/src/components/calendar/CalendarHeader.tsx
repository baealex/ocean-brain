import * as Icon from '~/components/icon';
import { Select, SelectItem, Text } from '~/components/ui';
import { CalendarMonthNavigation } from './CalendarMonthNavigation';
import type { CalendarDisplayType } from './types';

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
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

export const CalendarHeader = ({ month, year, type, onPrevMonth, onNextMonth, onToday, onTypeChange }: Props) => {
    const headerDescription = 'Track note activity and reminders across the month';

    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
                <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
                    <Text
                        as="h1"
                        variant="display"
                        weight="bold"
                        tracking="tighter"
                        className="text-2xl leading-none sm:text-[2.15rem]"
                    >
                        {MONTHS[month - 1]}
                    </Text>
                    <Text
                        as="span"
                        variant="subheading"
                        weight="medium"
                        tone="secondary"
                        tracking="tight"
                        className="pb-0.5"
                    >
                        {year}
                    </Text>
                </div>
                <Text as="p" variant="meta" weight="medium" tone="secondary" className="hidden sm:block">
                    {headerDescription}
                </Text>
            </div>

            <div className="flex lg:justify-end">
                <div className="flex w-full flex-col gap-2 sm:inline-flex sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center gap-2">
                        <Icon.Calendar className="h-4 w-4 shrink-0 text-fg-tertiary" />
                        <Text id="calendar-note-date-label" as="span" variant="label" weight="medium" tone="secondary">
                            Note date
                        </Text>
                        <Select
                            value={type}
                            aria-labelledby="calendar-note-date-label"
                            onValueChange={(value) => onTypeChange(value as CalendarDisplayType)}
                            variant="ghost"
                            size="sm"
                        >
                            <SelectItem value="create">Created</SelectItem>
                            <SelectItem value="update">Updated</SelectItem>
                        </Select>
                    </div>

                    <div className="hidden h-5 w-px bg-divider sm:block" />

                    <CalendarMonthNavigation onPrevMonth={onPrevMonth} onNextMonth={onNextMonth} onToday={onToday} />
                </div>
            </div>
        </div>
    );
};
