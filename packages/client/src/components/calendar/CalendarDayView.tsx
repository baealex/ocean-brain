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
    onSelect: () => void;
}

const NOTE_PREVIEW_TONE = 'bg-surface shadow-[inset_0_0_0_1px_var(--border-subtle)]';
const REMINDER_PREVIEW_TONE = 'bg-emphasis';

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
    onSelect,
}: CalendarDayViewProps) => {
    const totalCount = noteCount + reminderCount;
    const accessibleLabel = showReminderSummary
        ? `${dateLabel}, ${itemLabel(noteCount, 'note')}, ${itemLabel(reminderCount, 'reminder')}`
        : `${dateLabel}, ${itemLabel(noteCount, 'note')}`;
    const densityClassName =
        density === 'compact'
            ? 'min-h-16 p-1 sm:min-h-20 sm:p-2 lg:min-h-[142px] lg:p-2.5'
            : 'min-h-20 p-1 sm:min-h-24 sm:p-2 lg:min-h-[142px] lg:p-2.5';

    return (
        <button
            type="button"
            disabled={!isCurrentMonth}
            aria-label={accessibleLabel}
            aria-pressed={isCurrentMonth ? isSelected : undefined}
            aria-current={isCurrentMonth && isToday ? 'date' : undefined}
            onClick={onSelect}
            className={classNames(
                'focus-ring-soft relative flex min-w-0 flex-col text-left outline-none focus-visible:z-10',
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
                                    'flex min-h-7 min-w-0 items-center gap-1 rounded-[7px] px-1.5 py-1',
                                    item.type === 'reminder' ? REMINDER_PREVIEW_TONE : NOTE_PREVIEW_TONE,
                                )}
                            >
                                {item.type === 'reminder' ? (
                                    <Icon.Bell className="shrink-0 text-fg-tertiary" size={11} />
                                ) : (
                                    <Icon.FileNote className="shrink-0 text-fg-tertiary" size={11} />
                                )}
                                <Text
                                    as="span"
                                    variant="micro"
                                    weight="medium"
                                    tone="secondary"
                                    className={classNames(
                                        'truncate !text-[11px] !leading-4',
                                        item.isCompleted && 'line-through',
                                    )}
                                >
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
