import { render, screen } from '@testing-library/react';

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

        expect(screen.getByRole('checkbox', { name: 'Reminder: Follow up' })).toBeInTheDocument();
    });
});
