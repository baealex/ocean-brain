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

export const CalendarHeader = ({ month, year, type, onPrevMonth, onNextMonth, onToday, onTypeChange }: Props) => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-x-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <Text
                as="h1"
                variant="display"
                weight="bold"
                tracking="tighter"
                className="text-2xl leading-none sm:text-[2.15rem]"
            >
                {MONTHS[month - 1]}
            </Text>
            <Text as="span" variant="subheading" weight="medium" tone="secondary" tracking="tight">
                {year}
            </Text>
        </div>

        <CalendarMonthNavigation
            className="lg:order-3"
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onToday={onToday}
        />

        <div className="flex w-full items-center gap-2 sm:w-auto lg:order-1">
            <Icon.Calendar className="h-4 w-4 shrink-0 text-fg-tertiary" />
            <Text
                id="calendar-note-date-label"
                as="span"
                variant="label"
                weight="medium"
                tone="secondary"
                className="whitespace-nowrap"
            >
                Note date
            </Text>
            <Select
                value={type}
                aria-labelledby="calendar-note-date-label"
                onValueChange={(value) => onTypeChange(value as CalendarDisplayType)}
                variant="soft"
                size="sm"
                className="min-w-34"
            >
                <SelectItem value="create">Created</SelectItem>
                <SelectItem value="update">Last updated</SelectItem>
            </Select>
        </div>

        <div aria-hidden="true" className="hidden h-5 w-px bg-divider lg:order-2 lg:block" />
    </div>
);
