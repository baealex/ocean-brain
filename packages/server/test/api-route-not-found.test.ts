import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

import { createApp } from '../src/app.js';

test('returns a JSON 404 for unknown API routes instead of the SPA document', async (t) => {
    const server = createApp({ mode: 'open' }).listen(0);

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    t.after(() => server.close());

    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/does-not-exist`, {
        headers: { Accept: 'text/html' },
    });

    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
    assert.deepEqual(await response.json(), {
        code: 'API_ROUTE_NOT_FOUND',
        message: 'The requested API route was not found.',
    });
});
