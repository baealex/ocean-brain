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

test('resolveServeAuthEnvironment preserves explicit password mode', () => {
    const authEnv = resolveServeAuthEnvironment(
        { authMode: 'password' },
        {
            OCEAN_BRAIN_PASSWORD: 'secret',
            OCEAN_BRAIN_SESSION_SECRET: 'session-secret'
        }
    );

    assert.equal(authEnv.OCEAN_BRAIN_AUTH_MODE, 'password');
});

test('resolveServeAuthEnvironment throws on conflicting password mode and insecure flag', () => {
    assert.throws(
        () => resolveServeAuthEnvironment(
            {
                authMode: 'password',
                allowInsecureNoAuth: true
            },
            {
                OCEAN_BRAIN_PASSWORD: 'secret',
                OCEAN_BRAIN_SESSION_SECRET: 'session-secret'
            }
        ),
        /Conflicting auth config/
    );
});

test('resolveServeAuthEnvironment throws when password mode is missing session secret', () => {
    assert.throws(
        () => resolveServeAuthEnvironment(
            { authMode: 'password' },
            { OCEAN_BRAIN_PASSWORD: 'secret' }
        ),
        /OCEAN_BRAIN_SESSION_SECRET/
    );
});
