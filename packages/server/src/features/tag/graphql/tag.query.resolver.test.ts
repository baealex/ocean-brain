import assert from 'node:assert/strict';
import test from 'node:test';
import models from '~/models.js';
import { tagQueryResolvers } from './tag.query.resolver.js';

test('exact tag lookup includes unused tags beyond a substring search page', async () => {
    await models.tag.createMany({
        data: Array.from({ length: 101 }, (_, index) => ({ name: `@lookup-${index}` })),
    });
    const exact = await models.tag.create({ data: { name: '@lookup' } });
    const resolver = tagQueryResolvers.tagsByNames;
    assert.equal(typeof resolver, 'function');
    if (typeof resolver !== 'function') throw new Error('Expected tags resolver');
    const result = await resolver({}, { names: ['lookup', '@missing'] });
    assert.deepEqual(
        result.map((tag: { id: number }) => tag.id),
        [exact.id],
    );
});
