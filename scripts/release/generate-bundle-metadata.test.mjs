import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createCycloneDxBom, generateBundleMetadata } from './generate-bundle-metadata.mjs';

const writeJson = (filePath, value) => writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const createPackage = (nodeModulesDir, name, packageJson, licenseText) => {
    const packageRoot = path.join(nodeModulesDir, ...name.split('/'));
    mkdirSync(packageRoot, { recursive: true });
    writeJson(path.join(packageRoot, 'package.json'), { name, ...packageJson });
    writeFileSync(path.join(packageRoot, 'index.js'), 'export const value = true;\n', 'utf8');

    if (licenseText) {
        writeFileSync(path.join(packageRoot, 'LICENSE'), `${licenseText}\n`, 'utf8');
    }
};

test('CycloneDX metadata distinguishes SPDX identifiers from expressions', () => {
    const bom = createCycloneDxBom(
        { name: 'ocean-brain', version: '1.0.0' },
        [{
            name: 'dual-licensed',
            version: '1.0.0',
            license: '(MPL-2.0 OR Apache-2.0)',
            bundles: ['client'],
            licenseDocuments: [],
            source: 'https://www.npmjs.com/package/dual-licensed/v/1.0.0',
            sourceArchive: 'https://registry.npmjs.org/dual-licensed/-/dual-licensed-1.0.0.tgz',
        }],
    );

    assert.deepEqual(bom.components[0].licenses, [{ expression: '(MPL-2.0 OR Apache-2.0)' }]);
});

test('bundle metadata records exact bundled packages, licenses, source links, and bundle ownership', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-bundle-metadata-'));

    try {
        const cliDir = path.join(tempRoot, 'packages', 'cli');
        const serverDir = path.join(tempRoot, 'packages', 'server');
        const nodeModulesDir = path.join(tempRoot, 'node_modules');
        mkdirSync(path.join(cliDir, 'dist'), { recursive: true });
        mkdirSync(path.join(serverDir, 'dist'), { recursive: true });

        createPackage(nodeModulesDir, 'alpha', {
            version: '1.2.3',
            license: 'MIT',
            author: 'Alpha Author',
            repository: 'git+https://example.com/alpha.git',
        }, 'Alpha MIT license text');
        createPackage(nodeModulesDir, '@scope/bravo', {
            version: '4.5.6',
            license: 'MPL-2.0',
        }, 'Mozilla Public License Version 2.0');
        createPackage(nodeModulesDir, 'external-only', {
            version: '9.9.9',
            license: 'MIT',
        }, 'External license text');

        const cliMetafilePath = path.join(cliDir, 'dist', 'metafile-esm.json');
        const serverMetafilePath = path.join(serverDir, 'dist', 'metafile-esm.json');
        writeJson(cliMetafilePath, {
            inputs: {
                '../../node_modules/alpha/index.js': {},
                '../../node_modules/external-only/index.js': {},
                'src/index.ts': {},
            },
            outputs: {
                'dist/index.js': {
                    inputs: {
                        '../../node_modules/alpha/index.js': { bytesInOutput: 12 },
                        '../../node_modules/external-only/index.js': { bytesInOutput: 0 },
                        'src/index.ts': { bytesInOutput: 4 },
                    },
                },
            },
        });
        writeJson(serverMetafilePath, {
            inputs: {
                '../../node_modules/alpha/index.js': {},
                '../../node_modules/@scope/bravo/index.js': {},
            },
            outputs: {
                'dist/start.js': {
                    inputs: {
                        '../../node_modules/alpha/index.js': { bytesInOutput: 8 },
                        '../../node_modules/@scope/bravo/index.js': { bytesInOutput: 16 },
                    },
                },
            },
        });

        const cliPackageJsonPath = path.join(cliDir, 'package.json');
        const noticesPath = path.join(cliDir, 'THIRD_PARTY_NOTICES.txt');
        const sbomPath = path.join(cliDir, 'SBOM.cdx.json');
        writeJson(cliPackageJsonPath, { name: 'ocean-brain', version: '1.0.0' });

        const components = generateBundleMetadata({
            bundles: [
                { name: 'cli', packageDir: cliDir, metafilePath: cliMetafilePath },
                { name: 'server', packageDir: serverDir, metafilePath: serverMetafilePath },
            ],
            cliPackageJsonPath,
            noticesPath,
            sbomPath,
        });

        assert.deepEqual(components.map((component) => component.name), ['@scope/bravo', 'alpha']);
        assert.deepEqual(components.find((component) => component.name === 'alpha').bundles, ['cli', 'server']);

        const notices = readFileSync(noticesPath, 'utf8');
        assert.match(notices, /@scope\/bravo@4\.5\.6/);
        assert.match(notices, /Mozilla Public License Version 2\.0/);
        assert.match(notices, /https:\/\/www\.npmjs\.com\/package\/@scope\/bravo\/v\/4\.5\.6/);
        assert.doesNotMatch(notices, /external-only/);

        const bom = JSON.parse(readFileSync(sbomPath, 'utf8'));
        assert.equal(bom.bomFormat, 'CycloneDX');
        assert.equal(bom.specVersion, '1.6');
        assert.deepEqual(
            bom.components.map((component) => component['bom-ref']),
            ['pkg:npm/%40scope/bravo@4.5.6', 'pkg:npm/alpha@1.2.3'],
        );
        assert.equal(bom.dependencies, undefined);
        assert.deepEqual(bom.components[0].licenses, [{ license: { id: 'MPL-2.0' } }]);
        assert.deepEqual(bom.components[1].licenses, [{ license: { id: 'MIT' } }]);
        assert.equal(readFileSync(noticesPath, 'utf8').endsWith('\n'), true);
        assert.equal(readFileSync(sbomPath, 'utf8').endsWith('\n'), true);
        assert.equal(components.every((component) => component.packageRoots === undefined), true);
        assert.throws(() => readFileSync(cliMetafilePath), { code: 'ENOENT' });
        assert.throws(() => readFileSync(serverMetafilePath), { code: 'ENOENT' });
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('bundle metadata requires and embeds tracked license text for packages that omit it', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-license-override-'));

    try {
        const packageDir = path.join(tempRoot, 'package');
        const nodeModulesDir = path.join(tempRoot, 'node_modules');
        const metafilePath = path.join(packageDir, 'dist', 'bundle-metafile.json');
        const cliPackageJsonPath = path.join(packageDir, 'package.json');
        const noticesPath = path.join(packageDir, 'THIRD_PARTY_NOTICES.txt');
        const sbomPath = path.join(packageDir, 'SBOM.cdx.json');
        mkdirSync(path.dirname(metafilePath), { recursive: true });
        createPackage(nodeModulesDir, 'license-omitted', {
            version: '1.0.0',
            license: 'MIT',
        }, undefined);
        writeJson(metafilePath, { inputs: { '../node_modules/license-omitted/index.js': {} } });
        writeJson(cliPackageJsonPath, { name: 'ocean-brain', version: '1.0.0' });

        assert.throws(
            () => generateBundleMetadata({
                bundles: [{ name: 'client', packageDir, metafilePath }],
                cliPackageJsonPath,
                noticesPath,
                sbomPath,
                cleanupMetafiles: false,
            }),
            /license-omitted@1\.0\.0 has no included license text and no tracked license override/,
        );

        const overrideLicensePath = path.join(tempRoot, 'license-omitted-MIT.txt');
        const overrideManifestPath = path.join(tempRoot, 'license-overrides.json');
        writeFileSync(overrideLicensePath, 'MIT License\n\nCopyright Example\n', 'utf8');
        writeJson(overrideManifestPath, {
            overrides: [{
                components: ['license-omitted@1.0.0'],
                license: 'MIT',
                licenseFile: 'license-omitted-MIT.txt',
                source: 'https://spdx.org/licenses/MIT.html',
            }],
        });

        const components = generateBundleMetadata({
            bundles: [{ name: 'client', packageDir, metafilePath }],
            cliPackageJsonPath,
            noticesPath,
            sbomPath,
            licenseOverridesPath: overrideManifestPath,
        });

        assert.equal(components[0].licenseDocuments[0].source, 'https://spdx.org/licenses/MIT.html');
        assert.match(readFileSync(noticesPath, 'utf8'), /Copyright Example/);
        assert.match(readFileSync(noticesPath, 'utf8'), /License text source: https:\/\/spdx\.org\/licenses\/MIT\.html/);
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('bundle metadata inventories tracked static assets and rejects changed bytes', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-bundle-assets-'));

    try {
        const packageDir = path.join(tempRoot, 'client');
        const assetPath = path.join(packageDir, 'public', 'font.woff2');
        const licensePath = path.join(packageDir, 'public', 'FONT_LICENSE.txt');
        const manifestPath = path.join(packageDir, 'third-party-assets.json');
        const cliPackageJsonPath = path.join(tempRoot, 'package.json');
        const noticesPath = path.join(tempRoot, 'THIRD_PARTY_NOTICES.txt');
        const sbomPath = path.join(tempRoot, 'SBOM.cdx.json');
        const assetBytes = Buffer.from('font bytes');
        mkdirSync(path.dirname(assetPath), { recursive: true });
        writeFileSync(assetPath, assetBytes);
        writeFileSync(licensePath, 'SIL OPEN FONT LICENSE Version 1.1\n', 'utf8');
        writeJson(manifestPath, {
            components: [{
                name: 'example-font',
                version: '2.0.0',
                license: 'OFL-1.1',
                repository: 'https://example.com/example-font',
                source: 'https://www.npmjs.com/package/example-font/v/2.0.0',
                sourceArchive: 'https://registry.npmjs.org/example-font/-/example-font-2.0.0.tgz',
                bundles: ['client'],
                assets: [{ path: 'public/font.woff2', sha256: sha256(assetBytes) }],
                licenseFiles: ['public/FONT_LICENSE.txt'],
            }],
        });
        writeJson(cliPackageJsonPath, { name: 'ocean-brain', version: '1.0.0' });

        const options = {
            bundles: [],
            cliPackageJsonPath,
            noticesPath,
            sbomPath,
            assetManifests: [{ packageDir, manifestPath }],
        };
        const components = generateBundleMetadata(options);
        const bom = JSON.parse(readFileSync(sbomPath, 'utf8'));
        const bundledAssets = bom.components[0].properties.find(
            (property) => property.name === 'ocean-brain:bundled-assets',
        ).value;

        assert.deepEqual(components.map((component) => component.name), ['example-font']);
        assert.match(readFileSync(noticesPath, 'utf8'), /public\/font\.woff2 \(SHA-256:/);
        assert.equal(bundledAssets, `public/font.woff2#sha256=${sha256(assetBytes)}`);
        assert.deepEqual(bom.components[0].licenses, [{ license: { id: 'OFL-1.1' } }]);

        writeFileSync(assetPath, 'changed font bytes', 'utf8');
        assert.throws(() => generateBundleMetadata(options), /Bundled asset hash mismatch/);
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('bundle metadata rejects packages without declared licenses', () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-bundle-license-'));

    try {
        const packageDir = path.join(tempRoot, 'package');
        const nodeModulesDir = path.join(tempRoot, 'node_modules');
        mkdirSync(path.join(packageDir, 'dist'), { recursive: true });
        createPackage(nodeModulesDir, 'missing-license', { version: '1.0.0' }, undefined);

        const metafilePath = path.join(packageDir, 'dist', 'metafile-esm.json');
        const cliPackageJsonPath = path.join(packageDir, 'package.json');
        writeJson(metafilePath, { inputs: { '../node_modules/missing-license/index.js': {} } });
        writeJson(cliPackageJsonPath, { name: 'ocean-brain', version: '1.0.0' });

        assert.throws(
            () => generateBundleMetadata({
                bundles: [{ name: 'cli', packageDir, metafilePath }],
                cliPackageJsonPath,
                noticesPath: path.join(packageDir, 'THIRD_PARTY_NOTICES.txt'),
                sbomPath: path.join(packageDir, 'SBOM.cdx.json'),
            }),
            /missing-license@1\.0\.0 has no declared license/,
        );
    } finally {
        rmSync(tempRoot, { recursive: true, force: true });
    }
});
