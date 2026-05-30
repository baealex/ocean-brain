import assert from 'node:assert/strict';
import test from 'node:test';

import { noteFieldResolvers } from './note.field.resolver.js';

test('note field resolvers serialize date fields as ISO strings', () => {
    const note = {
        id: 7,
        title: 'Date note',
        content: JSON.stringify([]),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T03:04:05.000Z'),
        pinned: false,
        order: 0,
        layout: 'wide',
    };
    const resolvers = noteFieldResolvers as Record<string, (source: typeof note) => unknown>;

    assert.equal(resolvers.createdAt(note), '2026-04-01T00:00:00.000Z');
    assert.equal(resolvers.updatedAt(note), '2026-04-02T03:04:05.000Z');
});
