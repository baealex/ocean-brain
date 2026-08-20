#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_BUNDLED_COMPONENTS = [
    '@blocknote/core',
    '@modelcontextprotocol/sdk',
    'commander',
    'fastify',
    'jsdom',
    'mercurius',
    'pretendard',
    'vite',
    'zod',
];

const PRETENDARD_ASSETS = [
    {
        metadata: 'public/fonts/Pretendard-Bold.woff2#sha256=4609c3356e536fafe38f4add0daeceb3d8595d3057bce13c428c33ddbd43d362',
        tarballPath: 'package/server/client/dist/fonts/Pretendard-Bold.woff2',
    },
    {
        metadata: 'public/fonts/Pretendard-Regular.woff2#sha256=fad853f7f47c6c8b103171e7193fa095708cdcd70850a71d93aa5379e8a61d63',
        tarballPath: 'package/server/client/dist/fonts/Pretendard-Regular.woff2',
    },
];

const runTar = (args) => {
    const result = spawnSync('tar', args, {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`tar ${args.join(' ')} failed.\n${result.stderr}`);
    }

    return result.stdout;
};

const readTarEntry = (tarballPath, entry) => {
    const result = spawnSync('tar', ['-xOzf', tarballPath, entry], {
        maxBuffer: 32 * 1024 * 1024,
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`Unable to read ${entry} from the packed CLI.\n${result.stderr}`);
    }

    return result.stdout;
};

const componentPackageName = (component) => component.group
    ? `${component.group}/${component.name}`
    : component.name;

export const verifyCliTarball = (tarballPath) => {
    const resolvedTarball = path.resolve(tarballPath);
    const entries = runTar(['-tzf', resolvedTarball]).split(/\r?\n/).filter(Boolean);
    const requiredFiles = [
        'package/LICENSE',
        'package/SBOM.cdx.json',
        'package/THIRD_PARTY_NOTICES.txt',
        'package/server/client/dist/fonts/PRETENDARD_LICENSE.txt',
        ...PRETENDARD_ASSETS.map((asset) => asset.tarballPath),
    ];

    for (const requiredFile of requiredFiles) {
        if (!entries.includes(requiredFile)) {
            throw new Error(`Packed CLI is missing ${requiredFile}.`);
        }
    }

    const leakedMetafiles = entries.filter((entry) => /(?:bundle-)?metafile.*\.json$/i.test(entry));
    if (leakedMetafiles.length > 0) {
        throw new Error(`Packed CLI contains internal bundler metafiles: ${leakedMetafiles.join(', ')}`);
    }

    const notices = runTar(['-xOzf', resolvedTarball, 'package/THIRD_PARTY_NOTICES.txt']);
    const bom = JSON.parse(runTar(['-xOzf', resolvedTarball, 'package/SBOM.cdx.json']));

    if (bom.$schema !== 'http://cyclonedx.org/schema/bom-1.6.schema.json'
        || bom.bomFormat !== 'CycloneDX'
        || bom.specVersion !== '1.6'
        || !Array.isArray(bom.components)) {
        throw new Error('Packed CLI contains an invalid CycloneDX 1.6 bundle inventory header.');
    }

    const componentNames = new Set(bom.components.map(componentPackageName));
    for (const component of REQUIRED_BUNDLED_COMPONENTS) {
        if (!componentNames.has(component)) {
            throw new Error(`Packed CLI SBOM is missing bundled component ${component}.`);
        }
        if (!notices.includes(`${component}@`)) {
            throw new Error(`Packed CLI notices are missing bundled component ${component}.`);
        }
    }

    if (!notices.includes('Mozilla Public License Version 2.0')
        || !notices.includes('Corresponding source archive: https://registry.npmjs.org/@blocknote/core/')) {
        throw new Error('Packed CLI notices are missing the BlockNote MPL license or corresponding source archive.');
    }

    const pretendard = bom.components.find((component) => componentPackageName(component) === 'pretendard');
    const bundledAssets = pretendard?.properties?.find(
        (property) => property.name === 'ocean-brain:bundled-assets',
    )?.value;

    if (pretendard?.licenses?.[0]?.license?.id !== 'OFL-1.1'
        || PRETENDARD_ASSETS.some((asset) => !bundledAssets?.includes(asset.metadata))
        || !notices.includes('SIL OPEN FONT LICENSE Version 1.1')
        || PRETENDARD_ASSETS.some(
            (asset) => !notices.includes(asset.metadata.replace('#sha256=', ' (SHA-256: ')),
        )) {
        throw new Error('Packed CLI metadata is missing Pretendard assets, hashes, or the OFL-1.1 license.');
    }

    for (const asset of PRETENDARD_ASSETS) {
        const expectedSha256 = asset.metadata.slice(asset.metadata.indexOf('#sha256=') + '#sha256='.length);
        const actualSha256 = createHash('sha256').update(readTarEntry(resolvedTarball, asset.tarballPath)).digest('hex');

        if (actualSha256 !== expectedSha256) {
            throw new Error(
                `Packed CLI asset hash mismatch for ${asset.tarballPath}: expected ${expectedSha256}, got ${actualSha256}.`,
            );
        }
    }

    const invalidLicenseComponents = bom.components
        .filter((component) => !component.licenses?.some(
            (entry) => typeof entry.expression === 'string'
                || typeof entry.license?.id === 'string'
                || typeof entry.license?.name === 'string',
        ))
        .map(componentPackageName);

    if (invalidLicenseComponents.length > 0) {
        throw new Error(`Packed CLI SBOM has components without licenses: ${invalidLicenseComponents.join(', ')}`);
    }

    console.log(`CLI tarball metadata verified: ${bom.components.length} bundled components.`);
};

const [, , tarballPath] = process.argv;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (!tarballPath) {
        console.error('Usage: node scripts/ci/verify-cli-tarball.mjs <cli-tarball>');
        process.exit(1);
    }

    verifyCliTarball(tarballPath);
}
