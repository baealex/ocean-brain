import * as Icon from '~/components/icon';
import {
    Button,
    Select,
    SelectItem,
    Text
} from '~/components/ui';
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
                        className="text-2xl leading-none sm:text-[2.15rem]">
                        {MONTHS[month - 1]}
                    </Text>
                    <Text
                        as="span"
                        variant="subheading"
                        weight="medium"
                        tone="secondary"
                        tracking="tight"
                        className="pb-0.5">
                        {year}
                    </Text>
                </div>
                <Text
                    as="p"
                    variant="meta"
                    weight="medium"
                    tone="secondary">
                    {headerDescription}
                </Text>
            </div>

            <div className="flex lg:justify-end">
                <div className="surface-base inline-flex flex-wrap items-center gap-3 rounded-[16px] px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                        <Icon.Calendar className="h-4 w-4 shrink-0 text-fg-tertiary" />
                        <Text as="span" variant="label" weight="medium" tone="tertiary">
                            Note date
                        </Text>
                        <Select
                            value={type}
                            onValueChange={(value) => onTypeChange(value as CalendarDisplayType)}
                            variant="ghost"
                            size="sm">
                            <SelectItem value="create">Created</SelectItem>
                            <SelectItem value="update">Updated</SelectItem>
                        </Select>
                    </div>

                    <div className="h-5 w-px bg-divider" />

                    <div className="flex items-center gap-1.5">
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
            </div>
        </div>
    );
};
