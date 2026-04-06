import { Text } from '~/components/ui';

interface CalendarDayViewProps {
    day: number;
    cellClassName: string;
    dayNumberClassName: string;
    isCurrentMonth: boolean;
    items: React.ReactNode[];
    overflowCount: number;
    onOpenOverflow: () => void;
}

export const CalendarDayView = ({
    day,
    cellClassName,
    dayNumberClassName,
    isCurrentMonth,
    items,
    overflowCount,
    onOpenOverflow
}: CalendarDayViewProps) => {
    return (
        <div className={`min-h-[200px] rounded-[14px] border p-2 ${cellClassName}`.trim()}>
            <div className="mb-2 flex justify-end">
                <Text
                    as="span"
                    variant="label"
                    className={`flex h-6 w-6 items-center justify-center rounded-[8px] ${dayNumberClassName}`.trim()}>
                    {day}
                </Text>
            </div>

            {isCurrentMonth && items.length > 0 ? (
                <div className="flex flex-col gap-1">
                    {items}
                    {overflowCount > 0 ? (
                        <Text as="div" variant="micro" weight="semibold" tone="tertiary">
                            <button
                                type="button"
                                onClick={onOpenOverflow}
                                className="w-full rounded-[10px] py-1 text-center transition-colors hover:bg-hover-subtle hover:text-fg-muted">
                                +{overflowCount} more
                            </button>
                        </Text>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};
