import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { createApp } from '../src/app.js';
import { AUTH_SESSION_COOKIE_NAME, type AuthConfig } from '../src/modules/auth-mode.js';

const passwordAuthConfig: AuthConfig = {
    mode: 'password',
    password: 'secret',
    sessionSecret: 'session-secret',
    cookieName: AUTH_SESSION_COOKIE_NAME,
    source: 'password',
};

test('server rejects compressed JSON request bodies before authentication', async (t) => {
    const app = createApp(passwordAuthConfig);
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });

    t.after(() => app.close());

    const expandedBody = JSON.stringify({ padding: 'a'.repeat(8 * 1024 * 1024) });
    const compressedBody = gzipSync(expandedBody);

    assert.ok(compressedBody.length < 16 * 1024);

    const response = await fetch(`${baseUrl}/api/image`, {
        method: 'POST',
        headers: {
            'Content-Encoding': 'gzip',
            'Content-Type': 'application/json',
        },
        body: compressedBody,
    });
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 415);
    assert.deepEqual(body, {
        code: 'UNSUPPORTED_CONTENT_ENCODING',
        message: 'Compressed request bodies are not supported.',
    });
});
