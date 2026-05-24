import assert from 'node:assert/strict';
import test from 'node:test';

import { GraphQLError } from 'graphql';
import { noteMutationResolvers } from './note.mutation.resolver.js';

test('updateNote rejects malformed BlockNote JSON before writing', async () => {
    const updateNote = (noteMutationResolvers as Record<string, unknown>).updateNote as (
        parent: unknown,
        args: unknown,
        context: unknown,
    ) => Promise<unknown>;

    await assert.rejects(
        () =>
            updateNote(
                null,
                {
                    id: 7,
                    note: {
                        content: 'not-json',
                    },
                    expectedUpdatedAt: '1770000000000',
                },
                {},
            ),
        (error) => {
            assert.ok(error instanceof GraphQLError);
            assert.equal(error.extensions.code, 'INVALID_NOTE_CONTENT');
            return true;
        },
    );
});
