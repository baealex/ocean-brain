import test from 'node:test';
import assert from 'node:assert/strict';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generateBundleMetadata } from './generate-bundle-metadata.mjs';

const writeJson = (filePath, value) => writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const createPackage = (nodeModulesDir, name, packageJson, licenseText) => {
    const packageRoot = path.join(nodeModulesDir, ...name.split('/'));
    mkdirSync(packageRoot, { recursive: true });
    writeJson(path.join(packageRoot, 'package.json'), { name, ...packageJson });
    writeFileSync(path.join(packageRoot, 'index.js'), 'export const value = true;\n', 'utf8');

    if (licenseText) {
        writeFileSync(path.join(packageRoot, 'LICENSE'), `${licenseText}\n`, 'utf8');
    }
};

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
                'src/index.ts': {},
            },
        });
        writeJson(serverMetafilePath, {
            inputs: {
                '../../node_modules/alpha/index.js': {},
                '../../node_modules/@scope/bravo/index.js': {},
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
        assert.equal(bom.dependencies[0].dependsOn.length, 2);
        assert.equal(readFileSync(noticesPath, 'utf8').endsWith('\n'), true);
        assert.equal(readFileSync(sbomPath, 'utf8').endsWith('\n'), true);
        assert.equal(components.every((component) => component.packageRoots === undefined), true);
        assert.throws(() => readFileSync(cliMetafilePath), { code: 'ENOENT' });
        assert.throws(() => readFileSync(serverMetafilePath), { code: 'ENOENT' });
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
