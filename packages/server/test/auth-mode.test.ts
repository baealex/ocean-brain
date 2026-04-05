import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveAuthConfig } from '../src/modules/auth-mode.js';

test('resolveAuthConfig returns password mode when password env is present', () => {
    const authConfig = resolveAuthConfig({
        OCEAN_BRAIN_PASSWORD: 'secret',
        OCEAN_BRAIN_SESSION_SECRET: 'session-secret'
    });

    assert.equal(authConfig.mode, 'password');
    assert.equal(authConfig.source, 'auto');
});

test('resolveAuthConfig returns disabled mode when insecure flag is enabled', () => {
    const authConfig = resolveAuthConfig({ OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH: 'true' });

    assert.equal(authConfig.mode, 'disabled');
});

test('resolveAuthConfig throws when password mode is missing session secret', () => {
    assert.throws(
        () => resolveAuthConfig({ OCEAN_BRAIN_PASSWORD: 'secret' }),
        /OCEAN_BRAIN_SESSION_SECRET/
    );
});

test('resolveAuthConfig prioritizes insecure flag when both insecure flag and password env are present', () => {
    const authConfig = resolveAuthConfig({
        OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH: 'true',
        OCEAN_BRAIN_PASSWORD: 'secret'
    });

    assert.equal(authConfig.mode, 'disabled');
});
