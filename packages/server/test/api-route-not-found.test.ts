import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../src/app.js';

test('returns a JSON 404 for unknown API routes instead of the SPA document', async (t) => {
    const app = createApp({ mode: 'open' });
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });

    t.after(() => app.close());

    const response = await fetch(`${baseUrl}/api/does-not-exist`, {
        headers: { Accept: 'text/html' },
    });

    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
    assert.deepEqual(await response.json(), {
        code: 'API_ROUTE_NOT_FOUND',
        message: 'The requested API route was not found.',
    });
});
