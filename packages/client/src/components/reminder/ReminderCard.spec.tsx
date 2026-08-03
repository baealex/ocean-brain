import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Reminder } from '~/models/reminder.model';
import ReminderCard from './ReminderCard';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const createReminder = (patch: Partial<Reminder> = {}): Reminder => ({
    id: 'reminder-1',
    noteId: 1,
    reminderDate: String(Date.now() + 60_000),
    completed: false,
    priority: 'medium',
    content: 'Follow up',
    createdAt: '2026-06-23T00:00:00.000Z',
    updatedAt: '2026-06-23T00:00:00.000Z',
    ...patch,
});

describe('<ReminderCard />', () => {
    it('labels the completion checkbox with reminder context', () => {
        render(<ReminderCard reminder={createReminder()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

        expect(screen.getByRole('checkbox', { name: 'Complete reminder: Follow up' })).toBeInTheDocument();
    });

    it('presents completed reminders as reopenable history', async () => {
        const user = userEvent.setup();
        const onUpdate = vi.fn();

        render(<ReminderCard reminder={createReminder({ completed: true })} onUpdate={onUpdate} onDelete={vi.fn()} />);

        expect(screen.getByText('Completed')).toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: 'Reopen reminder: Follow up' }));

        expect(onUpdate).toHaveBeenCalledWith('reminder-1', '1', { completed: false });
    });
});
