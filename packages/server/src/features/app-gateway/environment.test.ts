import assert from 'node:assert/strict';
import test from 'node:test';
import { createEnvironmentAppGatewayOptions } from './environment.js';

const TOKEN = 'runner-token-that-is-longer-than-thirty-two-characters';
const managedManifest = JSON.stringify({
    schemaVersion: 1,
    apiVersion: 1,
    id: 'example.inbox',
    name: 'Inbox',
    version: '1.0.0',
    description: 'Read notes.',
    permissions: ['notes:read'],
    launch: { mode: 'managed' },
});

test('environment gateway configuration is opt-in and requires both runner settings', () => {
    assert.equal(createEnvironmentAppGatewayOptions({}), undefined);
    assert.throws(
        () => createEnvironmentAppGatewayOptions({ OCEAN_BRAIN_APP_RUNNER_ORIGIN: 'http://127.0.0.1:7790' }),
        /configured together/,
    );
    assert.throws(
        () => createEnvironmentAppGatewayOptions({ OCEAN_BRAIN_APP_RUNNER_TOKEN: TOKEN }),
        /configured together/,
    );
});

test('environment gateway resolves only managed integration connections', async () => {
    const records = new Map([
        [
            'managed-inbox',
            {
                id: 'managed-inbox',
                integrationId: 'example.inbox',
                manifest: managedManifest,
                enabled: true,
            },
        ],
        [
            'direct-inbox',
            {
                id: 'direct-inbox',
                integrationId: 'example.inbox',
                manifest: managedManifest.replace(
                    '{"mode":"managed"}',
                    '{"mode":"iframe","url":"http://127.0.0.1:7777"}',
                ),
                enabled: true,
            },
        ],
    ]);
    const options = createEnvironmentAppGatewayOptions(
        {
            OCEAN_BRAIN_APP_RUNNER_ORIGIN: 'http://127.0.0.1:7790',
            OCEAN_BRAIN_APP_RUNNER_TOKEN: TOKEN,
        },
        async (id) => records.get(id) ?? null,
    );
    assert.ok(options);
    assert.deepEqual(await options.resolveInstallation('managed-inbox'), {
        id: 'managed-inbox',
        appId: 'example.inbox',
        enabled: true,
    });
    assert.equal(await options.resolveInstallation('direct-inbox'), null);
    assert.equal(await options.resolveInstallation('missing'), null);
});
