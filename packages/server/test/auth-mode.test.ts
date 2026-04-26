import assert from 'node:assert/strict';
import test from 'node:test';

import { AUTH_SESSION_COOKIE_NAME, resolveAuthConfig } from '../src/modules/auth-mode.js';

test('resolveAuthConfig returns password mode when password env is present', () => {
    const authConfig = resolveAuthConfig({
        OCEAN_BRAIN_PASSWORD: 'secret',
        OCEAN_BRAIN_SESSION_SECRET: 'session-secret',
    });

    assert.equal(authConfig.mode, 'password');
    assert.equal(authConfig.source, 'password');
    assert.equal(authConfig.cookieName, AUTH_SESSION_COOKIE_NAME);
});

test('resolveAuthConfig returns open mode when insecure flag is enabled', () => {
    const authConfig = resolveAuthConfig({ OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH: 'true' });

    assert.deepEqual(authConfig, {
        mode: 'open',
        source: 'explicit-open',
        cookieName: AUTH_SESSION_COOKIE_NAME,
    });
});

test('resolveAuthConfig throws when password mode is missing session secret', () => {
    assert.throws(() => resolveAuthConfig({ OCEAN_BRAIN_PASSWORD: 'secret' }), /OCEAN_BRAIN_SESSION_SECRET/);
});

test('resolveAuthConfig fails closed when both insecure flag and password env are present', () => {
    assert.throws(
        () =>
            resolveAuthConfig({
                OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH: 'true',
                OCEAN_BRAIN_PASSWORD: 'secret',
                OCEAN_BRAIN_SESSION_SECRET: 'session-secret',
            }),
        /Conflicting auth config/,
    );
});
