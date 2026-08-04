import { render, screen } from '@testing-library/react';

vi.mock('./NoteCard', () => ({
    NoteCard: ({ note }: { note: { title: string } }) => <div data-testid="calendar-note-card">{note.title}</div>,
}));

vi.mock('./ReminderCard', () => ({
    ReminderCard: ({ reminder }: { reminder: { content: string } }) => (
        <div data-testid="calendar-reminder-card">{reminder.content}</div>
    ),
}));

import { CalendarDayDetail } from './CalendarDayDetail';
import type { CalendarDayData } from './types';

describe('<CalendarDayDetail />', () => {
    it('keeps the selected date visible without skeleton cards while activity is loading', () => {
        const day = {
            key: '2026-4-2',
            year: 2026,
            month: 4,
            day: 2,
            isCurrentMonth: true,
            isSunday: false,
            isToday: false,
            isPast: false,
            notes: [],
            reminders: [],
        } as CalendarDayData;

        render(<CalendarDayDetail day={day} type="create" isLoading />);

        expect(screen.getByRole('heading', { name: 'Thursday, April 2' })).toBeInTheDocument();
        expect(screen.getByText('Loading activity...')).toBeInTheDocument();
        expect(screen.queryByTestId(/calendar-(note|reminder)-card/)).not.toBeInTheDocument();
    });

    it('shows every item with reminders first for an upcoming day', () => {
        const day = {
            key: '2026-4-2',
            year: 2026,
            month: 4,
            day: 2,
            isCurrentMonth: true,
            isSunday: false,
            isToday: false,
            isPast: false,
            notes: [
                { id: 'n1', title: 'Note one' },
                { id: 'n2', title: 'Note two' },
            ],
            reminders: [
                { id: 'r1', content: 'Reminder one' },
                { id: 'r2', content: 'Reminder two' },
            ],
        } as CalendarDayData;

        render(<CalendarDayDetail day={day} type="create" isLoading={false} />);

        const items = screen.getAllByTestId(/calendar-(note|reminder)-card/).map((element) => element.textContent);

        expect(items).toEqual(['Reminder one', 'Reminder two', 'Note one', 'Note two']);
        expect(screen.getByRole('heading', { name: 'Thursday, April 2' })).toBeInTheDocument();
    });

    it('asks for a date before showing day details', () => {
        render(<CalendarDayDetail type="update" isLoading={false} />);

        expect(screen.getByText('Select a day to see its activity.')).toBeInTheDocument();
    });
});
