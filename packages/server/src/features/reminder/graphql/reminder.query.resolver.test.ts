import assert from 'node:assert/strict';
import test from 'node:test';
import { createNoteRemindersQueryResolver, createUpcomingRemindersQueryResolver } from './reminder.query.resolver.js';

test('noteReminders resolver applies note id and pagination to reminder queries', async () => {
    const seenArgs: Array<unknown> = [];
    const resolver = createNoteRemindersQueryResolver({
        countReminders: async (where) => {
            assert.deepEqual(where, { noteId: 12 });
            return 3;
        },
        findReminders: async (args) => {
            seenArgs.push(args);
            return [{ id: 1 }] as never;
        },
    });

    const result = await resolver(null, {
        noteId: '12',
        pagination: {
            limit: 5,
            offset: 10,
        },
    });

    assert.deepEqual(seenArgs, [
        {
            where: { noteId: 12 },
            orderBy: { reminderDate: 'asc' },
            take: 5,
            skip: 10,
        },
    ]);
    assert.deepEqual(result, {
        totalCount: 3,
        reminders: [{ id: 1 }],
    });
});

test('upcomingReminders resolver defaults pagination and includes notes', async () => {
    const resolver = createUpcomingRemindersQueryResolver({
        countReminders: async (where) => {
            assert.deepEqual(where, { completed: false });
            return 2;
        },
        findReminders: async (args) => {
            assert.deepEqual(args, {
                where: { completed: false },
                orderBy: { reminderDate: 'asc' },
                take: 10,
                skip: 0,
                include: { note: true },
            });
            return [{ id: 7 }] as never;
        },
    });

    const result = await resolver(null, { pagination: undefined as never });

    assert.deepEqual(result, {
        totalCount: 2,
        reminders: [{ id: 7 }],
    });
});
