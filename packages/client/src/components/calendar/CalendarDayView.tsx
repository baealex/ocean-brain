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
    onOpenOverflow,
}: CalendarDayViewProps) => {
    return (
        <div className={`min-h-[196px] rounded-[16px] border p-2.5 ${cellClassName}`.trim()}>
            <div className="mb-2.5 flex justify-end">
                <Text
                    as="span"
                    variant="label"
                    className={`flex h-7 w-7 items-center justify-center rounded-[10px] ${dayNumberClassName}`.trim()}
                >
                    {day}
                </Text>
            </div>

            {isCurrentMonth && items.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    {items}
                    {overflowCount > 0 ? (
                        <button
                            type="button"
                            onClick={onOpenOverflow}
                            className="focus-ring-soft w-full rounded-[10px] border border-dashed border-border-subtle/70 bg-subtle/70 py-1 text-center text-micro font-semibold text-fg-tertiary outline-none transition-colors hover:border-border-secondary/70 hover:bg-hover-subtle hover:text-fg-secondary"
                        >
                            +{overflowCount} more
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};
