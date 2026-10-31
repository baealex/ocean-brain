import classNames from 'classnames';

import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import type { CalendarDayPreviewItem } from './types';

interface CalendarDayViewProps {
    day: number;
    dateLabel: string;
    cellClassName: string;
    dayNumberClassName: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    noteCount: number;
    reminderCount: number;
    previewItems: CalendarDayPreviewItem[];
    overflowCount: number;
    density?: 'comfortable' | 'compact';
    showReminderSummary?: boolean;
    adjacentMonthLabel?: string;
    onSelect: () => void;
}

const PRIORITY_ICON_CLASS_NAMES: Record<string, string> = {
    high: 'text-priority-high',
    medium: 'text-priority-medium',
    low: 'text-priority-low',
};

const getPreviewToneClassName = (item: CalendarDayPreviewItem) => {
    if (item.type === 'reminder' && item.isOverdue) return 'bg-accent-soft-danger';
    if (item.type === 'reminder' && item.isCompleted) return 'bg-accent-soft-success';
    return 'bg-emphasis/80';
};

const getPreviewIconClassName = (item: CalendarDayPreviewItem) => {
    if (item.type === 'note' || item.isCompleted) return 'text-fg-tertiary';
    if (item.isOverdue) return 'text-fg-error';
    return PRIORITY_ICON_CLASS_NAMES[item.priority ?? 'low'] ?? PRIORITY_ICON_CLASS_NAMES.low;
};

const itemLabel = (count: number, singular: string) => `${count} ${count === 1 ? singular : `${singular}s`}`;

export const CalendarDayView = ({
    day,
    dateLabel,
    cellClassName,
    dayNumberClassName,
    isCurrentMonth,
    isToday,
    isSelected,
    noteCount,
    reminderCount,
    previewItems,
    overflowCount,
    density = 'comfortable',
    showReminderSummary = true,
    adjacentMonthLabel,
    onSelect,
}: CalendarDayViewProps) => {
    const totalCount = noteCount + reminderCount;
    const opensAdjacentMonth = !isCurrentMonth && Boolean(adjacentMonthLabel);
    const accessibleLabel = opensAdjacentMonth
        ? `${dateLabel}, ${adjacentMonthLabel}`
        : showReminderSummary
          ? `${dateLabel}, ${itemLabel(noteCount, 'note')}, ${itemLabel(reminderCount, 'reminder')}`
          : `${dateLabel}, ${itemLabel(noteCount, 'note')}`;
    const densityClassName =
        density === 'compact'
            ? 'min-h-16 p-1 sm:min-h-20 sm:p-2 lg:min-h-[142px] lg:p-1.5 2xl:p-2.5'
            : 'min-h-20 p-1 sm:min-h-24 sm:p-2 lg:min-h-[142px] lg:p-1.5 2xl:p-2.5';

    return (
        <button
            type="button"
            disabled={!isCurrentMonth && !opensAdjacentMonth}
            aria-label={accessibleLabel}
            aria-pressed={isCurrentMonth ? isSelected : undefined}
            aria-current={isCurrentMonth && isToday ? 'date' : undefined}
            onClick={onSelect}
            className={classNames(
                'focus-ring-soft relative flex min-w-0 flex-col rounded-[10px] border text-left outline-none transition-colors focus-visible:z-10 sm:rounded-[12px]',
                densityClassName,
                cellClassName,
            )}
        >
            <Text
                as="span"
                variant="label"
                className={classNames(
                    'flex h-6 min-w-6 items-center justify-center self-end whitespace-nowrap rounded-[9px] px-1.5 sm:h-7 sm:min-w-7 lg:!text-sm',
                    dayNumberClassName,
                )}
            >
                {day}
            </Text>

            {isCurrentMonth && totalCount > 0 ? (
                <div aria-hidden="true" className="mt-1.5 w-full sm:mt-2">
                    <div className="flex flex-col items-start gap-0 text-fg-tertiary lg:hidden">
                        {noteCount > 0 ? (
                            <span className="inline-flex h-4 items-center gap-1 leading-none">
                                <Icon.FileNote className="shrink-0" size={10} />
                                <Text
                                    as="span"
                                    variant="micro"
                                    weight="semibold"
                                    tone="secondary"
                                    className="whitespace-nowrap !text-[10px] !leading-3 tabular-nums"
                                >
                                    {noteCount}
                                </Text>
                            </span>
                        ) : null}
                        {showReminderSummary && reminderCount > 0 ? (
                            <span className="inline-flex h-4 items-center gap-1 leading-none">
                                <Icon.Bell className="shrink-0" size={10} />
                                <Text
                                    as="span"
                                    variant="micro"
                                    weight="semibold"
                                    tone="secondary"
                                    className="whitespace-nowrap !text-[10px] !leading-3 tabular-nums"
                                >
                                    {reminderCount}
                                </Text>
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-1.5 hidden flex-col gap-1 lg:flex">
                        {previewItems.map((item) => (
                            <span
                                key={item.key}
                                className={classNames(
                                    'flex min-h-7 min-w-0 items-center rounded-[8px] px-1.5 py-1',
                                    getPreviewToneClassName(item),
                                )}
                            >
                                <Text
                                    as="span"
                                    variant="micro"
                                    weight="medium"
                                    tone={item.isOverdue ? 'error' : item.isCompleted ? 'tertiary' : 'default'}
                                    className={classNames(
                                        'line-clamp-2 min-w-0 !text-[11px] !leading-4 wrap-anywhere',
                                        item.isCompleted && 'line-through',
                                    )}
                                >
                                    {/* Inline so a wrapped second line can use the width under the icon. */}
                                    {item.type === 'reminder' ? (
                                        <Icon.Bell
                                            className={classNames(
                                                'mr-1 inline-block align-[-1px]',
                                                getPreviewIconClassName(item),
                                            )}
                                            size={11}
                                            weight={item.isOverdue || item.isCompleted ? 'regular' : 'fill'}
                                        />
                                    ) : (
                                        <Icon.FileNote
                                            className={classNames(
                                                'mr-1 inline-block align-[-1px]',
                                                getPreviewIconClassName(item),
                                            )}
                                            size={11}
                                        />
                                    )}
                                    {item.title}
                                </Text>
                            </span>
                        ))}
                        {overflowCount > 0 ? (
                            <Text
                                as="span"
                                variant="micro"
                                weight="medium"
                                tone="secondary"
                                className="flex min-h-4 items-center px-2 !text-[11px] !leading-4"
                            >
                                +{overflowCount} more
                            </Text>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </button>
    );
};
