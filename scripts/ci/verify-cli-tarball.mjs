#!/usr/bin/env node

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
    'zod',
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
