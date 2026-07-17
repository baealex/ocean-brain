import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
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
    const server = app.listen(0);

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    });

    const address = server.address() as AddressInfo;
    const expandedBody = JSON.stringify({ padding: 'a'.repeat(8 * 1024 * 1024) });
    const compressedBody = gzipSync(expandedBody);

    assert.ok(compressedBody.length < 16 * 1024);

    const response = await fetch(`http://127.0.0.1:${address.port}/api/image`, {
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
