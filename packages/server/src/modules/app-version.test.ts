import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    buildOceanBrainVersionInfo,
    getOceanBrainVersionInfo,
    parseMajorMinorVersion,
    resolveMcpCompatibilityVersion,
    resolveMcpCompatibilityVersionFromPaths,
    resolveOceanBrainVersion,
} from './app-version.js';

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

test('resolveMcpCompatibilityVersion reads explicit package compatibility metadata', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-version-'));
    const packageJsonPath = path.join(tempDir, 'package.json');

    try {
        fs.writeFileSync(
            packageJsonPath,
            JSON.stringify({
                version: '9.9.9',
                oceanBrain: { mcpCompatibilityVersion: '0.8.0' },
            }),
        );

        assert.equal(resolveMcpCompatibilityVersion(), '0.8.0');
        assert.equal(resolveMcpCompatibilityVersionFromPaths([packageJsonPath]), '0.8.0');
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('resolveMcpCompatibilityVersion requires explicit compatibility metadata', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-version-'));
    const packageJsonPath = path.join(tempDir, 'package.json');

    try {
        fs.writeFileSync(packageJsonPath, JSON.stringify({ version: '9.9.9' }));

        assert.throws(
            () => resolveMcpCompatibilityVersionFromPaths([packageJsonPath]),
            /MCP compatibility version is required/,
        );
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('buildOceanBrainVersionInfo keeps app version and MCP compatibility requirement independent', () => {
    const info = buildOceanBrainVersionInfo({
        version: '0.8.0',
        mcpCompatibilityVersion: '0.8.0',
    });

    assert.equal(info.version, '0.8.0');
    assert.equal(info.mcpVersionRequirement, '0.8.x');
    assert.equal(info.mcp.compatibilityVersion, '0.8.0');
    assert.equal(info.mcp.compatibilityRequirement, '0.8.x');
});

test('getOceanBrainVersionInfo returns server-owned release and MCP compatibility metadata', () => {
    const info = getOceanBrainVersionInfo();

    assert.match(info.version, /^\d+\.\d+\.\d+/);
    assert.match(info.mcpVersionRequirement, /^\d+\.\d+\.x$/);
    assert.equal(info.mcp.compatibilityVersion, resolveMcpCompatibilityVersion());
    assert.equal(info.mcp.compatibilityRequirement, info.mcpVersionRequirement);
    assert.equal(info.releaseUrl, 'https://github.com/baealex/ocean-brain/releases');
});
