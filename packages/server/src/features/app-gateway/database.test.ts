import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabaseAppGatewayOptions } from './database.js';

const proxiedManifest = JSON.stringify({
    schemaVersion: 1,
    apiVersion: 1,
    id: 'example.inbox',
    name: 'Inbox',
    version: '1.0.0',
    description: 'Read notes.',
    permissions: ['notes:read'],
    launch: { mode: 'proxied' },
});

test('database gateway resolves only proxied integration connections', async () => {
    const records = new Map([
        [
            'proxied-inbox',
            {
                id: 'proxied-inbox',
                integrationId: 'example.inbox',
                manifest: proxiedManifest,
                proxyUrl: 'http://127.0.0.1:7777',
                enabled: true,
            },
        ],
        [
            'direct-inbox',
            {
                id: 'direct-inbox',
                integrationId: 'example.inbox',
                manifest: proxiedManifest.replace(
                    '{"mode":"proxied"}',
                    '{"mode":"iframe","url":"http://127.0.0.1:7777"}',
                ),
                proxyUrl: null,
                enabled: true,
            },
        ],
    ]);
    const options = createDatabaseAppGatewayOptions(async (id: string) => records.get(id) ?? null);

    assert.deepEqual(await options.resolveConnection('proxied-inbox'), {
        id: 'proxied-inbox',
        integrationId: 'example.inbox',
        proxyUrl: 'http://127.0.0.1:7777',
        enabled: true,
    });
    assert.equal(await options.resolveConnection('direct-inbox'), null);
    assert.equal(await options.resolveConnection('missing'), null);
});
