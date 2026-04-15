import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageReferenceCountFieldResolver } from './image.field.resolver.js';

test('Image.referenceCount counts note references for the image url', async () => {
    let requestedUrl = '';

    const resolver = createImageReferenceCountFieldResolver(async (url) => {
        requestedUrl = url;
        return 5;
    });

    const result = await resolver({
        id: 2,
        url: '/assets/images/2026/4/15/reference.png',
    } as never);

    assert.equal(requestedUrl, '/assets/images/2026/4/15/reference.png');
    assert.equal(result, 5);
});
