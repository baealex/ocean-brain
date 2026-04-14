import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createCreateReminderMutationResolver,
    createDeleteReminderMutationResolver,
    createUpdateReminderMutationResolver,
} from './reminder.mutation.resolver.js';

test('createReminder resolver normalizes note id, date, and default priority', async () => {
    const resolver = createCreateReminderMutationResolver({
        createReminder: async (data) => data as never,
    });

    const result = await resolver(null, {
        noteId: '9',
        reminderDate: '2026-04-16T09:00:00.000Z',
        content: 'Follow up',
    });

    assert.deepEqual(result, {
        noteId: 9,
        reminderDate: new Date('2026-04-16T09:00:00.000Z'),
        completed: false,
        priority: 'medium',
        content: 'Follow up',
    });
});

test('updateReminder resolver only forwards provided fields', async () => {
    const resolver = createUpdateReminderMutationResolver({
        updateReminder: async (id, data) => ({ id, data }) as never,
    });

    const result = await resolver(null, {
        id: '14',
        completed: true,
        content: '',
    });

    assert.deepEqual(result, {
        id: 14,
        data: {
            completed: true,
            content: '',
        },
    });
});

test('deleteReminder resolver deletes by numeric id and returns true', async () => {
    const deletedIds: number[] = [];
    const resolver = createDeleteReminderMutationResolver({
        deleteReminder: async (id) => {
            deletedIds.push(id);
        },
    });

    const result = await resolver(null, { id: '5' });

    assert.deepEqual(deletedIds, [5]);
    assert.equal(result, true);
});
