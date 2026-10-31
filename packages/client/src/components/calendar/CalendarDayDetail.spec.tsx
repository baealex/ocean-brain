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

    it('lists notes and reminders of the day in time order', () => {
        const at = (hour: number) => String(new Date(2026, 3, 2, hour).getTime());
        const day = {
            key: '2026-4-2',
            year: 2026,
            month: 4,
            day: 2,
            isCurrentMonth: true,
            isSunday: false,
            isToday: false,
            isPast: true,
            notes: [
                { id: 'n1', title: 'Morning note', createdAt: at(9), updatedAt: at(20) },
                { id: 'n2', title: 'Afternoon note', createdAt: at(15), updatedAt: at(16) },
            ],
            reminders: [{ id: 'r1', content: 'Noon reminder', reminderDate: at(12) }],
        } as CalendarDayData;

        render(<CalendarDayDetail day={day} type="create" isLoading={false} />);

        const items = screen.getAllByTestId(/calendar-(note|reminder)-card/).map((element) => element.textContent);

        expect(items).toEqual(['Morning note', 'Noon reminder', 'Afternoon note']);
    });

    it('explains when the month has no activity to select', () => {
        render(<CalendarDayDetail type="update" isLoading={false} />);

        expect(screen.getByText('No notes or reminders this month.')).toBeInTheDocument();
    });

    it('waits for activity before explaining an empty month', () => {
        render(<CalendarDayDetail type="update" isLoading />);

        expect(screen.getByText('Loading activity...')).toBeInTheDocument();
        expect(screen.queryByText('No notes or reminders this month.')).not.toBeInTheDocument();
    });
});
