import type { Reminder, ReminderPriority } from '~/models/reminder.model';
import { createLocalDemoState } from '~/test/local-demo-state';

import { remindersLocalPlugin } from './reminders';

const createReminder = (
    id: string,
    reminderDate: string,
    options: { completed?: boolean; priority?: ReminderPriority; updatedAt?: string } = {},
): Reminder => ({
    id,
    noteId: 1,
    reminderDate,
    completed: options.completed ?? false,
    priority: options.priority ?? 'medium',
    content: `Reminder ${id}`,
    createdAt: reminderDate,
    updatedAt: options.updatedAt ?? reminderDate,
});

describe('remindersLocalPlugin', () => {
    it('filters open reminders with an exclusive end boundary and stable sorting', () => {
        const state = createLocalDemoState();
        state.reminders = [
            createReminder('later', '2026-08-08T18:00:00.000Z', { priority: 'high' }),
            createReminder('earlier', '2026-08-08T09:00:00.000Z', { priority: 'high' }),
            createReminder('tomorrow', '2026-08-09T00:00:00.000Z', { priority: 'high' }),
            createReminder('completed', '2026-08-08T10:00:00.000Z', { completed: true, priority: 'high' }),
            createReminder('medium', '2026-08-08T11:00:00.000Z'),
        ];
        const handler = remindersLocalPlugin.graphHandlers?.FetchReminders;

        const response = handler?.({
            state,
            variables: {
                filter: {
                    status: 'open',
                    priority: 'high',
                    start: '2026-08-08T00:00:00.000Z',
                    end: '2026-08-09T00:00:00.000Z',
                    sortBy: 'reminderDate',
                    sortOrder: 'asc',
                },
                pagination: { limit: 25, offset: 0 },
            },
            save: vi.fn(),
        });
        const reminders = response && 'reminders' in response ? response.reminders : undefined;

        expect(reminders).toMatchObject({ totalCount: 2 });
        expect(reminders?.reminders.map((reminder) => reminder.id)).toEqual(['earlier', 'later']);
    });

    it('sorts upcoming reminders by date like the server resolver', () => {
        const state = createLocalDemoState();
        state.reminders = [
            createReminder('later', '2026-08-10T09:00:00.000Z'),
            createReminder('earlier', '2026-08-09T09:00:00.000Z'),
        ];
        const handler = remindersLocalPlugin.graphHandlers?.FetchUpcomingReminders;

        const response = handler?.({
            state,
            variables: { pagination: { limit: 10, offset: 0 } },
            save: vi.fn(),
        });
        const upcoming = response && 'upcomingReminders' in response ? response.upcomingReminders : undefined;

        expect(upcoming?.reminders.map((reminder) => reminder.id)).toEqual(['earlier', 'later']);
    });

    it('sorts note reminders by date like the server resolver', () => {
        const state = createLocalDemoState();
        state.reminders = [
            { ...createReminder('later', '2026-08-10T09:00:00.000Z'), noteId: 7 },
            { ...createReminder('other-note', '2026-08-08T09:00:00.000Z'), noteId: 8 },
            { ...createReminder('earlier', '2026-08-09T09:00:00.000Z'), noteId: 7 },
        ];
        const handler = remindersLocalPlugin.graphHandlers?.FetchNoteReminders;

        const response = handler?.({
            state,
            variables: { noteId: 7, pagination: { limit: 10, offset: 0 } },
            save: vi.fn(),
        });
        const noteReminders = response && 'noteReminders' in response ? response.noteReminders : undefined;

        expect(noteReminders?.reminders.map((reminder) => reminder.id)).toEqual(['earlier', 'later']);
    });

    it('persists reminder creation and returns the created reminder', () => {
        const state = createLocalDemoState();
        const save = vi.fn();
        const handler = remindersLocalPlugin.graphHandlers?.CreateReminder;

        const response = handler?.({
            state,
            variables: {
                noteId: 7,
                reminderDate: '2026-08-08T12:30:00.000Z',
                priority: 'high',
                content: 'Follow up',
            },
            save,
        });
        const created = response && 'createReminder' in response ? response.createReminder : undefined;

        expect(created).toMatchObject({
            noteId: 7,
            reminderDate: String(new Date('2026-08-08T12:30:00.000Z').getTime()),
            priority: 'high',
            content: 'Follow up',
            completed: false,
        });
        expect(state.reminders).toContain(created);
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('returns a GraphQL-shaped error without saving when an update target is missing', () => {
        const state = createLocalDemoState();
        const save = vi.fn();
        const handler = remindersLocalPlugin.graphHandlers?.UpdateReminder;

        const response = handler?.({
            state,
            variables: { id: 'missing', completed: true },
            save,
        });

        expect(response).toEqual({
            type: 'error',
            category: 'graphql',
            errors: [{ code: 'LOCAL_ONLY_DEMO_ERROR', message: 'Reminder not found' }],
        });
        expect(save).not.toHaveBeenCalled();
    });
});
