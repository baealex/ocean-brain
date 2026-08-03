import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createNoteRemindersQueryResolver,
    createRemindersQueryResolver,
    createUpcomingRemindersQueryResolver,
} from './reminder.query.resolver.js';

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

test('reminders resolver applies status, priority, date bounds, sorting, and pagination', async () => {
    const start = '2026-08-03T00:00:00.000Z';
    const end = '2026-08-04T00:00:00.000Z';
    const expectedWhere = {
        completed: false,
        priority: 'high',
        reminderDate: {
            gte: new Date(start),
            lt: new Date(end),
        },
    };
    const resolver = createRemindersQueryResolver({
        countReminders: async (where) => {
            assert.deepEqual(where, expectedWhere);
            return 4;
        },
        findReminders: async (args) => {
            assert.deepEqual(args, {
                where: expectedWhere,
                orderBy: [{ reminderDate: 'desc' }, { id: 'desc' }],
                take: 10,
                skip: 20,
                include: { note: true },
            });
            return [{ id: 9 }] as never;
        },
    });

    const result = await resolver(null, {
        filter: {
            status: 'open',
            priority: 'high',
            start,
            end,
            sortBy: 'reminderDate',
            sortOrder: 'desc',
        },
        pagination: {
            limit: 10,
            offset: 20,
        },
    });

    assert.deepEqual(result, {
        totalCount: 4,
        reminders: [{ id: 9 }],
    });
});

test('reminders resolver can list recently updated completed reminders', async () => {
    const resolver = createRemindersQueryResolver({
        countReminders: async (where) => {
            assert.deepEqual(where, { completed: true });
            return 1;
        },
        findReminders: async (args) => {
            assert.deepEqual(args, {
                where: { completed: true },
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                take: 25,
                skip: 0,
                include: { note: true },
            });
            return [{ id: 11 }] as never;
        },
    });

    const result = await resolver(null, {
        filter: {
            status: 'completed',
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        },
    });

    assert.deepEqual(result, {
        totalCount: 1,
        reminders: [{ id: 11 }],
    });
});

test('reminders resolver bounds pagination before querying', async () => {
    const resolver = createRemindersQueryResolver({
        countReminders: async () => 0,
        findReminders: async (args) => {
            assert.equal(args.take, 100);
            assert.equal(args.skip, 0);
            return [];
        },
    });

    await resolver(null, {
        filter: { status: 'completed' },
        pagination: { limit: 1_000, offset: -10 },
    });
});

test('reminders resolver rejects invalid date filters instead of dropping them', async () => {
    const resolver = createRemindersQueryResolver({
        countReminders: async () => 0,
        findReminders: async () => [],
    });

    await assert.rejects(
        resolver(null, {
            filter: { status: 'open', start: 'not-a-date' },
        }),
        /valid date strings/,
    );
});
