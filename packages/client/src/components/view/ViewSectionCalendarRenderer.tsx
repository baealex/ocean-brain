import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import { fetchViewSectionCalendarNotes, type ViewCalendarNote } from '~/apis/view.api';
import {
    CalendarDayView,
    CalendarEntryCard,
    CalendarGrid,
    type CalendarGridDay,
    CalendarMonthNavigation,
} from '~/components/calendar';
import {
    buildCalendarGridDays,
    getCalendarDateOnlyMonthRange,
    getCalendarMonthRange,
    toCalendarTimestamp,
} from '~/components/calendar/calendar-data';
import * as Icon from '~/components/icon';
import { Button, Modal, Text } from '~/components/ui';
import type { ViewSection } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import type { ViewSectionRouteState, ViewSectionRouteStateUpdater } from '~/modules/view-route-state';

const MAX_PREVIEW_NOTES = 2;

interface ViewCalendarDay extends CalendarGridDay {
    notes: ViewCalendarNote[];
}

interface ViewSectionCalendarRendererProps {
    section: ViewSection;
    calendarDateProperty?: NotePropertyKeySummary;
    navigationState: ViewSectionRouteState;
    onNavigationStateChange: (updater: ViewSectionRouteStateUpdater) => void;
}

const getDateFieldLabel = (section: ViewSection, calendarDateProperty?: NotePropertyKeySummary) => {
    if (section.displayOptions.calendarDateField === 'property') {
        return calendarDateProperty?.name ?? section.displayOptions.calendarDatePropertyKey ?? 'Date property';
    }

    return section.displayOptions.calendarDateField === 'updatedAt' ? 'Updated date' : 'Created date';
};

const getDateOnlyDayKey = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }

    return `${year}-${month}-${day}`;
};

const getTimestampDayKey = (value: string) => {
    const timestamp = toCalendarTimestamp(value);

    if (!Number.isFinite(timestamp)) {
        return null;
    }

    const date = dayjs(timestamp);
    return `${date.year()}-${date.month() + 1}-${date.date()}`;
};

const getCellClassName = (day: ViewCalendarDay, isSelected: boolean) => {
    if (!day.isCurrentMonth) {
        return 'cursor-default bg-[var(--page-bg)] text-fg-disabled';
    }

    if (isSelected) {
        return 'bg-elevated shadow-[inset_0_0_0_1px_var(--border-secondary)] hover:bg-surface';
    }

    return 'bg-surface hover:bg-muted';
};

const getDayNumberClassName = (day: ViewCalendarDay) => {
    if (day.isToday) {
        return 'bg-cta font-semibold text-fg-on-filled';
    }

    if (!day.isCurrentMonth) {
        return 'font-medium text-fg-tertiary';
    }

    return day.isSunday ? 'font-semibold text-fg-weekend' : 'font-semibold text-fg-secondary';
};

export default function ViewSectionCalendarRenderer({
    section,
    calendarDateProperty,
    navigationState,
    onNavigationStateChange,
}: ViewSectionCalendarRendererProps) {
    const today = dayjs();
    const year = navigationState.calendar?.year ?? today.year();
    const month = navigationState.calendar?.month ?? today.month() + 1;
    const monthLabel = dayjs(new Date(year, month - 1, 1)).format('MMMM YYYY');
    const dateField = section.displayOptions.calendarDateField;
    const isDateProperty = dateField === 'property';
    const dateFieldLabel = getDateFieldLabel(section, calendarDateProperty);
    const dateRange = isDateProperty ? getCalendarDateOnlyMonthRange(year, month) : getCalendarMonthRange(year, month);
    const [selectedDayKey, setSelectedDayKey] = useState<string>();

    const { data, isPending, isError, refetch } = useQuery({
        queryKey: queryKeys.views.sectionCalendar(section.id, {
            year,
            month,
            dateField,
            propertyKey: section.displayOptions.calendarDatePropertyKey,
        }),
        async queryFn() {
            const response = await fetchViewSectionCalendarNotes(section.id, dateRange);

            if (response.type === 'error') {
                throw response;
            }

            return response.viewSectionCalendarNotes;
        },
    });

    const days = useMemo<ViewCalendarDay[]>(() => {
        const notesByDay = new Map<string, ViewCalendarNote[]>();

        for (const note of data ?? []) {
            const key = isDateProperty ? getDateOnlyDayKey(note.calendarDate) : getTimestampDayKey(note.calendarDate);

            if (!key) {
                continue;
            }

            const dayNotes = notesByDay.get(key) ?? [];
            dayNotes.push(note);
            notesByDay.set(key, dayNotes);
        }

        for (const dayNotes of notesByDay.values()) {
            dayNotes.sort((left, right) => {
                const comparison = isDateProperty
                    ? left.calendarDate.localeCompare(right.calendarDate)
                    : toCalendarTimestamp(left.calendarDate) - toCalendarTimestamp(right.calendarDate);
                return comparison || left.id.localeCompare(right.id);
            });
        }

        return buildCalendarGridDays(year, month).map((day) => ({
            ...day,
            notes: notesByDay.get(day.key) ?? [],
        }));
    }, [data, isDateProperty, month, year]);

    const selectedDay = days.find((day) => day.key === selectedDayKey);
    const selectedDayHeading = selectedDay
        ? dayjs(new Date(selectedDay.year, selectedDay.month - 1, selectedDay.day)).format('dddd, MMMM D')
        : 'Day notes';

    const setVisibleMonth = (nextYear: number, nextMonth: number) => {
        const isCurrentMonth = nextYear === today.year() && nextMonth === today.month() + 1;
        setSelectedDayKey(undefined);
        onNavigationStateChange((current) => ({
            ...current,
            calendar: isCurrentMonth ? undefined : { year: nextYear, month: nextMonth },
        }));
    };

    const moveMonth = (offset: -1 | 1) => {
        const nextDate = new Date(year, month - 1 + offset, 1);
        setVisibleMonth(nextDate.getFullYear(), nextDate.getMonth() + 1);
    };

    const totalNotes = data?.length ?? 0;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-3 border-b border-border-subtle/75 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <Text as="h3" variant="subheading" weight="semibold" tracking="tight">
                        {monthLabel}
                    </Text>
                    <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                        Notes placed by {dateFieldLabel.toLowerCase()}
                    </Text>
                </div>
                <CalendarMonthNavigation
                    onToday={() => setVisibleMonth(today.year(), today.month() + 1)}
                    onPrevMonth={() => moveMonth(-1)}
                    onNextMonth={() => moveMonth(1)}
                />
            </div>

            {isError ? (
                <div className="m-4 rounded-[16px] border border-border-subtle bg-hover-subtle/70 p-4">
                    <Text as="p" variant="body" weight="semibold">
                        Failed to load this calendar
                    </Text>
                    <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                        Retry to refresh notes for {monthLabel}.
                    </Text>
                    <div className="mt-3">
                        <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()}>
                            Retry
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="min-w-0 px-4 py-3.5">
                    <CalendarGrid isLoading={isPending} ariaLabel={`${monthLabel} note calendar`}>
                        {days.map((day) => {
                            const isSelected = day.key === selectedDayKey;
                            const previewItems = day.notes.slice(0, MAX_PREVIEW_NOTES).map((note) => ({
                                key: `note-${note.id}`,
                                type: 'note' as const,
                                title: note.title || 'Untitled',
                            }));

                            return (
                                <CalendarDayView
                                    key={day.key}
                                    day={day.day}
                                    dateLabel={dayjs(new Date(day.year, day.month - 1, day.day)).format(
                                        'dddd, MMMM D, YYYY',
                                    )}
                                    cellClassName={getCellClassName(day, isSelected)}
                                    dayNumberClassName={getDayNumberClassName(day)}
                                    isCurrentMonth={day.isCurrentMonth}
                                    isToday={day.isToday}
                                    isSelected={isSelected}
                                    noteCount={day.notes.length}
                                    reminderCount={0}
                                    previewItems={previewItems}
                                    overflowCount={Math.max(0, day.notes.length - MAX_PREVIEW_NOTES)}
                                    density="compact"
                                    showReminderSummary={false}
                                    onSelect={() => setSelectedDayKey(day.key)}
                                />
                            );
                        })}
                    </CalendarGrid>
                </div>
            )}

            <div className="mt-auto border-t border-border-subtle/75 px-4 py-3">
                <Text as="p" variant="meta" tone="tertiary">
                    {isPending
                        ? 'Loading calendar notes...'
                        : isError
                          ? `Calendar notes for ${monthLabel} are unavailable`
                          : totalNotes === 0
                            ? `No matching notes in ${monthLabel}`
                            : `${totalNotes} matching note${totalNotes === 1 ? '' : 's'} in ${monthLabel}`}
                </Text>
            </div>

            <Modal isOpen={Boolean(selectedDay)} onClose={() => setSelectedDayKey(undefined)} variant="inspect">
                <Modal.Header title={selectedDayHeading} onClose={() => setSelectedDayKey(undefined)} />
                <Modal.Body>
                    <Modal.Description className="sr-only">
                        View matching notes placed on {selectedDayHeading} by {dateFieldLabel.toLowerCase()}.
                    </Modal.Description>
                    <Text as="p" variant="label" weight="medium" tone="secondary" className="mb-3">
                        {selectedDay?.notes.length ?? 0} matching{' '}
                        {(selectedDay?.notes.length ?? 0) === 1 ? 'note' : 'notes'}
                    </Text>
                    <div className="flex flex-col gap-1">
                        {selectedDay?.notes.map((note) => (
                            <CalendarEntryCard
                                key={note.id}
                                params={{ id: note.id }}
                                header={<Icon.FileNote size={12} />}
                                title={note.title || 'Untitled'}
                                meta={
                                    isDateProperty
                                        ? undefined
                                        : dayjs(toCalendarTimestamp(note.calendarDate)).format('HH:mm')
                                }
                            />
                        ))}
                    </div>
                </Modal.Body>
            </Modal>
        </div>
    );
}
