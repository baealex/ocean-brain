import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveServeAuthEnvironment } from '../src/auth-options.js';

test('resolveServeAuthEnvironment maps allow insecure flag to canonical env', () => {
    const authEnv = resolveServeAuthEnvironment(
        { allowInsecureNoAuth: true },
        {}
    );

    assert.equal(authEnv.OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH, 'true');
});

test('resolveServeAuthEnvironment validates password mode requirements when password env is present', () => {
    assert.throws(
        () => resolveServeAuthEnvironment(
            {},
            { OCEAN_BRAIN_PASSWORD: 'secret' }
        ),
        /OCEAN_BRAIN_SESSION_SECRET/
    );
});

test('resolveServeAuthEnvironment fails closed when insecure flag and password env are both set', () => {
    assert.throws(
        () => resolveServeAuthEnvironment(
            { allowInsecureNoAuth: true },
            {
                OCEAN_BRAIN_PASSWORD: 'secret'
            }
        ),
        /Conflicting auth config/
    );
});

test('resolveServeAuthEnvironment validates explicit insecure flag from existing env', () => {
    const authEnv = resolveServeAuthEnvironment(
        {},
        { OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH: 'true' }
    );

    assert.equal(authEnv.OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH, 'true');
});
