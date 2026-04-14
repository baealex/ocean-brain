import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./NoteCard', () => ({
    NoteCard: ({ note }: { note: { title: string } }) => <div data-testid="calendar-note-card">{note.title}</div>,
}));

vi.mock('./ReminderCard', () => ({
    ReminderCard: ({ reminder }: { reminder: { content: string } }) => (
        <div data-testid="calendar-reminder-card">{reminder.content}</div>
    ),
}));

import { CalendarDay } from './CalendarDay';

describe('<CalendarDay />', () => {
    it('prioritizes reminders before notes for upcoming days', () => {
        render(
            <CalendarDay
                year={2026}
                month={4}
                day={2}
                isCurrentMonth
                isSunday={false}
                isToday={false}
                isPast={false}
                notes={
                    [
                        {
                            id: 'n1',
                            title: 'Note one',
                        },
                        {
                            id: 'n2',
                            title: 'Note two',
                        },
                    ] as never[]
                }
                reminders={
                    [
                        {
                            id: 'r1',
                            content: 'Reminder one',
                        },
                        {
                            id: 'r2',
                            content: 'Reminder two',
                        },
                    ] as never[]
                }
                type="create"
            />,
        );

        const visibleCards = screen
            .getAllByTestId(/calendar-(note|reminder)-card/)
            .map((element) => element.textContent);

        expect(visibleCards).toEqual(['Reminder one', 'Reminder two', 'Note one']);
        expect(screen.getByRole('button', { name: '+1 more' })).toBeInTheDocument();
    });

    it('opens an overflow dialog with the full day contents', async () => {
        const user = userEvent.setup();

        render(
            <CalendarDay
                year={2026}
                month={4}
                day={2}
                isCurrentMonth
                isSunday={false}
                isToday={false}
                isPast
                notes={
                    [
                        {
                            id: 'n1',
                            title: 'Note one',
                        },
                        {
                            id: 'n2',
                            title: 'Note two',
                        },
                    ] as never[]
                }
                reminders={
                    [
                        {
                            id: 'r1',
                            content: 'Reminder one',
                        },
                        {
                            id: 'r2',
                            content: 'Reminder two',
                        },
                    ] as never[]
                }
                type="create"
            />,
        );

        await user.click(screen.getByRole('button', { name: '+1 more' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getAllByTestId('calendar-note-card')).toHaveLength(4);
        expect(screen.getAllByTestId('calendar-reminder-card')).toHaveLength(3);
    });
});
