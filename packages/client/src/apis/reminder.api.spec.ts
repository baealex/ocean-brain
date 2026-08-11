// @vitest-environment node
import {
    createReminder,
    deleteReminder,
    fetchNoteReminders,
    fetchOpenReminderOverview,
    updateReminder,
} from '~/apis/reminder.api';
import { graphQuery } from '~/modules/graph-query';

vi.mock('~/modules/graph-query', () => ({ graphQuery: vi.fn() }));

describe('reminder.api', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(graphQuery).mockResolvedValue({ type: 'success' } as never);
    });

    it('uses default pagination when fetching reminders for a note', async () => {
        await fetchNoteReminders('note-7');

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('query FetchNoteReminders'), {
            noteId: 'note-7',
            pagination: { limit: 10, offset: 0 },
        });
    });

    it('builds non-overlapping overdue, today, and upcoming overview filters', async () => {
        await fetchOpenReminderOverview({
            now: '2026-08-08T00:00:00.000Z',
            tomorrow: '2026-08-09T00:00:00.000Z',
            priority: 'high',
            limit: 7,
        });

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('query FetchOpenReminderOverview'), {
            overdueFilter: {
                status: 'open',
                priority: 'high',
                end: '2026-08-08T00:00:00.000Z',
                sortBy: 'reminderDate',
                sortOrder: 'desc',
            },
            todayFilter: {
                status: 'open',
                priority: 'high',
                start: '2026-08-08T00:00:00.000Z',
                end: '2026-08-09T00:00:00.000Z',
                sortBy: 'reminderDate',
                sortOrder: 'asc',
            },
            upcomingFilter: {
                status: 'open',
                priority: 'high',
                start: '2026-08-09T00:00:00.000Z',
                sortBy: 'reminderDate',
                sortOrder: 'asc',
            },
            pagination: { limit: 7, offset: 0 },
        });
    });

    it('serializes reminder creation dates and applies the default priority', async () => {
        await createReminder({
            noteId: 'note-7',
            reminderDate: new Date('2026-08-08T12:30:00.000Z'),
            content: 'Follow up',
        });

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('mutation CreateReminder'), {
            noteId: 'note-7',
            reminderDate: '2026-08-08T12:30:00.000Z',
            priority: 'medium',
            content: 'Follow up',
        });
    });

    it('preserves explicit false and empty values in reminder updates', async () => {
        await updateReminder({
            id: 'reminder-3',
            reminderDate: new Date('2026-08-10T09:00:00.000Z'),
            completed: false,
            content: '',
        });

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('mutation UpdateReminder'), {
            id: 'reminder-3',
            reminderDate: '2026-08-10T09:00:00.000Z',
            completed: false,
            content: '',
        });
    });

    it('sends reminder deletion ids through GraphQL variables', async () => {
        await deleteReminder('reminder-3');

        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('mutation DeleteReminder'), {
            id: 'reminder-3',
        });
    });
});
