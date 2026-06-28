import assert from 'node:assert/strict';
import test from 'node:test';
import { getOceanBrainVersionInfo, parseMajorMinorVersion, resolveOceanBrainVersion } from './app-version.js';

test('parseMajorMinorVersion accepts semantic version strings with optional prefix and metadata', () => {
    assert.deepEqual(parseMajorMinorVersion('v1.2.3'), { major: 1, minor: 2 });
    assert.deepEqual(parseMajorMinorVersion('1.2.3-beta.1'), { major: 1, minor: 2 });
    assert.equal(parseMajorMinorVersion('local-demo'), null);
});

test('resolveOceanBrainVersion prefers package metadata over environment overrides', () => {
    const previousVersion = process.env.OCEAN_BRAIN_VERSION;
    process.env.OCEAN_BRAIN_VERSION = '99.99.99';

    try {
        assert.notEqual(resolveOceanBrainVersion(), '99.99.99');
    } finally {
        if (previousVersion === undefined) {
            delete process.env.OCEAN_BRAIN_VERSION;
        } else {
            process.env.OCEAN_BRAIN_VERSION = previousVersion;
        }
    }
});

test('getOceanBrainVersionInfo returns server-owned release metadata', () => {
    const info = getOceanBrainVersionInfo();

    assert.match(info.version, /^\d+\.\d+\.\d+/);
    assert.match(info.mcpVersionRequirement, /^\d+\.\d+\.x$/);
    assert.equal(info.releaseUrl, 'https://github.com/baealex/ocean-brain/releases');
});
