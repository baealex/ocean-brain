import assert from 'node:assert/strict';
import test from 'node:test';

import { noteFieldResolvers } from './note.field.resolver.js';

test('note field resolvers leave date fields on the GraphQL default serializer', () => {
    assert.equal(Object.hasOwn(noteFieldResolvers, 'createdAt'), false);
    assert.equal(Object.hasOwn(noteFieldResolvers, 'updatedAt'), false);
});
