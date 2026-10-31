import dayjs from 'dayjs';
import { useMemo } from 'react';

import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import { toCalendarTimestamp } from './calendar-data';
import { NoteCard } from './NoteCard';
import { ReminderCard } from './ReminderCard';
import type { CalendarDayData, CalendarDisplayType, CalendarItem } from './types';

interface CalendarDayDetailProps {
    day?: CalendarDayData;
    type: CalendarDisplayType;
    isLoading: boolean;
    presentation?: 'rail' | 'modal';
}

const renderItems = (items: CalendarItem[], type: CalendarDisplayType) =>
    items.map((calendarItem) =>
        calendarItem.type === 'note' ? (
            <NoteCard key={`note-${calendarItem.item.id}`} note={calendarItem.item} type={type} />
        ) : (
            <ReminderCard key={`reminder-${calendarItem.item.id}`} reminder={calendarItem.item} />
        ),
    );

const formatCount = (count: number, singular: string) => `${count} ${count === 1 ? singular : `${singular}s`}`;

const getItemTimestamp = (calendarItem: CalendarItem, type: CalendarDisplayType) =>
    calendarItem.type === 'note'
        ? toCalendarTimestamp(type === 'create' ? calendarItem.item.createdAt : calendarItem.item.updatedAt)
        : toCalendarTimestamp(calendarItem.item.reminderDate);
const RAIL_ACTIVITY_CLASS_NAME =
    'mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain pr-2 [scrollbar-color:var(--border-secondary)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-secondary [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5';

export const getCalendarDayHeading = (day: CalendarDayData) =>
    dayjs(new Date(day.year, day.month - 1, day.day)).format('dddd, MMMM D');

export const CalendarDayDetail = ({ day, type, isLoading, presentation = 'rail' }: CalendarDayDetailProps) => {
    const sortedItems = useMemo<CalendarItem[]>(() => {
        if (!day) return [];

        const items: CalendarItem[] = [
            ...day.notes.map((note): CalendarItem => ({ type: 'note', item: note })),
            ...day.reminders.map((reminder): CalendarItem => ({ type: 'reminder', item: reminder })),
        ];

        return items.sort((left, right) => getItemTimestamp(left, type) - getItemTimestamp(right, type));
    }, [day, type]);

    if (!day) {
        return (
            <section aria-label="Day details" className="flex h-full min-h-40 items-center justify-center text-center">
                <Text as="p" variant="meta" weight="medium" tone="secondary">
                    {isLoading ? 'Loading activity...' : 'No notes or reminders this month.'}
                </Text>
            </section>
        );
    }

    const heading = getCalendarDayHeading(day);
    const summary = isLoading
        ? 'Loading activity...'
        : [formatCount(day.notes.length, 'note'), formatCount(day.reminders.length, 'reminder')].join(' · ');
    const activity = isLoading ? null : (
        <div className={presentation === 'rail' ? RAIL_ACTIVITY_CLASS_NAME : 'flex flex-col gap-1'}>
            {sortedItems.length > 0 ? (
                renderItems(sortedItems, type)
            ) : (
                <Text as="p" variant="meta" weight="medium" tone="secondary" className="py-8 text-center">
                    No activity on this day.
                </Text>
            )}
        </div>
    );

    if (presentation === 'modal') {
        return (
            <div aria-label={`${heading} activity`}>
                <Text as="p" variant="label" weight="medium" tone="secondary" className="mb-3">
                    {summary}
                </Text>
                {activity}
            </div>
        );
    }

    return (
        <section aria-label={`${heading} details`} className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-start gap-2 border-b border-border-subtle/80 pb-3">
                <Icon.Calendar aria-hidden="true" className="mt-0.5 shrink-0 text-fg-tertiary" size={15} />
                <div className="min-w-0">
                    <Text as="h2" variant="subheading" weight="semibold" tracking="tight">
                        {heading}
                    </Text>
                    <Text as="p" variant="label" weight="medium" tone="secondary" className="mt-0.5">
                        {summary}
                    </Text>
                </div>
            </div>
            {activity}
        </section>
    );
};
