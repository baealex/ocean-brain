import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSchema } from 'graphql';
import { cacheTypeDefs } from './cache.type-defs.js';

test('cache query allows a missing cache entry', () => {
    const schema = buildSchema(cacheTypeDefs);
    const cacheField = schema.getQueryType()?.getFields().cache;

    assert.ok(cacheField);
    assert.equal(cacheField.type.toString(), 'Cache');
});
