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
        <div className={`min-h-[140px] rounded-[14px] border p-2 ${cellClassName}`.trim()}>
            <div className="mb-2 flex justify-end">
                <span
                    className={`flex h-7 w-7 items-center justify-center rounded-[10px] text-sm ${dayNumberClassName}`.trim()}>
                    {day}
                </span>
            </div>

            {isCurrentMonth && items.length > 0 ? (
                <div className="flex flex-col gap-1">
                    {items}
                    {overflowCount > 0 ? (
                        <button
                            type="button"
                            onClick={onOpenOverflow}
                            className="text-micro rounded-[10px] py-1 text-center font-semibold text-fg-tertiary transition-colors hover:bg-hover-subtle hover:text-fg-muted">
                            +{overflowCount} more
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};
