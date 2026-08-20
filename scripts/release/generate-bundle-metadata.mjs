#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
    existsSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const LICENSE_FILE_PATTERN = /^(?:licen[cs]e|copying|notice|copyright|authors)(?:$|[._-])/i;

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const normalizeText = (value) => value.replace(/\r\n/g, '\n').trim();

const requireNonEmptyString = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${field} must be a non-empty string.`);
    }

    return value.trim();
};

const sha256File = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex');

const packageRepositoryUrl = (packageJson) => {
    const repository = typeof packageJson.repository === 'string'
        ? packageJson.repository
        : packageJson.repository?.url;

    if (!repository) return undefined;

    return repository
        .replace(/^git\+/, '')
        .replace(/^git:\/\//, 'https://')
        .replace(/\.git$/, '');
};

const packageLicense = (packageJson) => {
    if (typeof packageJson.license === 'string' && packageJson.license.trim()) {
        return packageJson.license.trim();
    }

    if (Array.isArray(packageJson.licenses)) {
        const licenses = packageJson.licenses
            .map((entry) => typeof entry === 'string' ? entry : entry?.type)
            .filter(Boolean);

        if (licenses.length > 0) {
            return licenses.join(' OR ');
        }
    }

    return 'UNKNOWN';
};

const packageAuthor = (packageJson) => {
    if (typeof packageJson.author === 'string' && packageJson.author.trim()) {
        return packageJson.author.trim();
    }

    if (packageJson.author && typeof packageJson.author === 'object') {
        return [packageJson.author.name, packageJson.author.email, packageJson.author.url]
            .filter(Boolean)
            .join(' ');
    }

    return undefined;
};

const findPackageRoot = (inputPath) => {
    let current = path.dirname(inputPath);

    while (current !== path.dirname(current)) {
        if (!current.split(path.sep).includes('node_modules')) {
            return undefined;
        }

        const packageJsonPath = path.join(current, 'package.json');
        if (existsSync(packageJsonPath)) {
            const packageJson = readJson(packageJsonPath);
            if (typeof packageJson.name === 'string' && typeof packageJson.version === 'string') {
                return { packageJson, packageJsonPath, root: current };
            }
        }

        current = path.dirname(current);
    }

    return undefined;
};

const readLicenseDocuments = (packageRoot) => readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENSE_FILE_PATTERN.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
        name: entry.name,
        text: normalizeText(readFileSync(path.join(packageRoot, entry.name), 'utf8')),
    }))
    .filter((document) => document.text.length > 0);

const npmSourceUrl = (name, version) => `https://www.npmjs.com/package/${name}/v/${version}`;

const npmSourceArchiveUrl = (name, version) => {
    const unscopedName = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name;
    return `https://registry.npmjs.org/${name}/-/${unscopedName}-${version}.tgz`;
};

const splitPackageName = (name) => {
    if (!name.startsWith('@')) {
        return { name };
    }

    const separator = name.indexOf('/');
    return {
        group: name.slice(0, separator),
        name: name.slice(separator + 1),
    };
};

const npmPurl = (name, version) => {
    const parts = splitPackageName(name);
    const namespace = parts.group ? `${encodeURIComponent(parts.group)}/` : '';
    return `pkg:npm/${namespace}${encodeURIComponent(parts.name)}@${encodeURIComponent(version)}`;
};

const readLicenseOverrides = (manifestPath) => {
    if (!manifestPath) return new Map();

    const manifest = readJson(manifestPath);
    if (!Array.isArray(manifest.overrides)) {
        throw new Error(`${manifestPath} must contain an overrides array.`);
    }

    const overrides = new Map();

    for (const [index, override] of manifest.overrides.entries()) {
        const field = `overrides[${index}]`;
        const license = requireNonEmptyString(override.license, `${field}.license`);
        const licenseFile = requireNonEmptyString(override.licenseFile, `${field}.licenseFile`);
        const source = requireNonEmptyString(override.source, `${field}.source`);
        const licensePath = path.resolve(path.dirname(manifestPath), licenseFile);
        const document = {
            name: path.basename(licenseFile),
            source,
            text: normalizeText(readFileSync(licensePath, 'utf8')),
        };

        if (!document.text) {
            throw new Error(`${licensePath} is empty.`);
        }

        if (!Array.isArray(override.components) || override.components.length === 0) {
            throw new Error(`${field}.components must be a non-empty array.`);
        }

        for (const component of override.components) {
            const key = requireNonEmptyString(component, `${field}.components[]`);
            if (overrides.has(key)) {
                throw new Error(`Duplicate license override for ${key}.`);
            }
            overrides.set(key, { document, license });
        }
    }

    return overrides;
};

const collectAssetComponents = (assetManifests) => {
    const components = [];

    for (const assetManifest of assetManifests) {
        const manifest = readJson(assetManifest.manifestPath);

        if (!Array.isArray(manifest.components)) {
            throw new Error(`${assetManifest.manifestPath} must contain a components array.`);
        }

        for (const [index, entry] of manifest.components.entries()) {
            const field = `components[${index}]`;
            const name = requireNonEmptyString(entry.name, `${field}.name`);
            const version = requireNonEmptyString(entry.version, `${field}.version`);
            const license = requireNonEmptyString(entry.license, `${field}.license`);
            const source = requireNonEmptyString(entry.source, `${field}.source`);
            const sourceArchive = requireNonEmptyString(entry.sourceArchive, `${field}.sourceArchive`);

            if (!Array.isArray(entry.bundles) || entry.bundles.length === 0) {
                throw new Error(`${field}.bundles must be a non-empty array.`);
            }

            if (!Array.isArray(entry.assets) || entry.assets.length === 0) {
                throw new Error(`${field}.assets must be a non-empty array.`);
            }

            if (!Array.isArray(entry.licenseFiles) || entry.licenseFiles.length === 0) {
                throw new Error(`${field}.licenseFiles must be a non-empty array.`);
            }

            const assetFiles = entry.assets.map((asset, assetIndex) => {
                const assetField = `${field}.assets[${assetIndex}]`;
                const relativePath = requireNonEmptyString(asset.path, `${assetField}.path`);
                const expectedSha256 = requireNonEmptyString(asset.sha256, `${assetField}.sha256`).toLowerCase();
                const assetPath = path.resolve(assetManifest.packageDir, relativePath);
                const actualSha256 = sha256File(assetPath);

                if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
                    throw new Error(`${assetField}.sha256 must be a SHA-256 hex digest.`);
                }

                if (actualSha256 !== expectedSha256) {
                    throw new Error(
                        `Bundled asset hash mismatch for ${assetPath}: expected ${expectedSha256}, got ${actualSha256}.`,
                    );
                }

                return { path: relativePath.replaceAll('\\', '/'), sha256: actualSha256 };
            });
            const licenseDocuments = entry.licenseFiles.map((licenseFile, licenseIndex) => {
                const relativePath = requireNonEmptyString(
                    licenseFile,
                    `${field}.licenseFiles[${licenseIndex}]`,
                );
                const licensePath = path.resolve(assetManifest.packageDir, relativePath);
                const text = normalizeText(readFileSync(licensePath, 'utf8'));

                if (!text) {
                    throw new Error(`${licensePath} is empty.`);
                }

                return { name: relativePath.replaceAll('\\', '/'), text };
            });

            components.push({
                name,
                version,
                license,
                author: typeof entry.author === 'string' ? entry.author.trim() || undefined : undefined,
                repository: typeof entry.repository === 'string' ? entry.repository.trim() || undefined : undefined,
                source,
                sourceArchive,
                bundles: [...new Set(entry.bundles.map((bundle) => requireNonEmptyString(bundle, `${field}.bundles[]`)))].sort(),
                licenseDocuments,
                assetFiles: assetFiles.sort((left, right) => left.path.localeCompare(right.path)),
            });
        }
    }

    return components;
};

const contributingInputs = (metafile) => {
    const outputs = Object.values(metafile.outputs ?? {});

    if (outputs.length === 0) {
        return Object.keys(metafile.inputs ?? {});
    }

    const inputs = new Set();

    for (const output of outputs) {
        for (const [input, contribution] of Object.entries(output.inputs ?? {})) {
            if ((contribution.bytesInOutput ?? 0) > 0) {
                inputs.add(input);
            }
        }
    }

    return [...inputs];
};

export const collectBundledComponents = (
    bundles,
    { assetManifests = [], licenseOverridesPath } = {},
) => {
    const components = new Map();
    const licenseOverrides = readLicenseOverrides(licenseOverridesPath);

    for (const bundle of bundles) {
        const metafile = readJson(bundle.metafilePath);

        for (const input of contributingInputs(metafile)) {
            if (input.startsWith('<')) continue;

            const inputPath = path.resolve(bundle.packageDir, input);
            if (!inputPath.split(path.sep).includes('node_modules')) continue;

            const resolvedPackage = findPackageRoot(inputPath);
            if (!resolvedPackage) {
                throw new Error(`Unable to resolve the npm package for bundled input: ${inputPath}`);
            }

            const { packageJson, root } = resolvedPackage;
            const key = `${packageJson.name}@${packageJson.version}`;
            const existing = components.get(key);

            if (existing) {
                existing.bundles.add(bundle.name);
                existing.packageRoots.add(root);
                continue;
            }

            components.set(key, {
                name: packageJson.name,
                version: packageJson.version,
                license: packageLicense(packageJson),
                author: packageAuthor(packageJson),
                repository: packageRepositoryUrl(packageJson),
                source: npmSourceUrl(packageJson.name, packageJson.version),
                sourceArchive: npmSourceArchiveUrl(packageJson.name, packageJson.version),
                bundles: new Set([bundle.name]),
                packageRoots: new Set([root]),
            });
        }
    }

    const npmComponents = [...components.values()]
        .map((component) => {
            const documents = new Map();

            for (const packageRoot of component.packageRoots) {
                for (const document of readLicenseDocuments(packageRoot)) {
                    documents.set(`${document.name}\0${document.text}`, document);
                }
            }

            if (component.license === 'UNKNOWN' && documents.size === 0) {
                throw new Error(`Bundled package ${component.name}@${component.version} has no declared license.`);
            }

            if (documents.size === 0) {
                const key = `${component.name}@${component.version}`;
                const override = licenseOverrides.get(key);

                if (!override) {
                    throw new Error(
                        `Bundled package ${key} has no included license text and no tracked license override.`,
                    );
                }

                if (override.license !== component.license) {
                    throw new Error(
                        `License override for ${key} declares ${override.license}, but package.json declares ${component.license}.`,
                    );
                }

                documents.set(`${override.document.name}\0${override.document.text}`, override.document);
            }

            const license = component.license === 'UNKNOWN'
                ? `See included ${[...documents.values()].map((document) => document.name).join(', ')}`
                : component.license;

            return {
                ...component,
                license,
                bundles: [...component.bundles].sort(),
                licenseDocuments: [...documents.values()],
                packageRoots: undefined,
            };
        });
    const assetComponents = collectAssetComponents(assetManifests);
    const componentKeys = new Set(npmComponents.map((component) => `${component.name}@${component.version}`));

    for (const component of assetComponents) {
        const key = `${component.name}@${component.version}`;
        if (componentKeys.has(key)) {
            throw new Error(`Bundled component ${key} is declared by both a JavaScript graph and an asset manifest.`);
        }
        componentKeys.add(key);
    }

    return [...npmComponents, ...assetComponents]
        .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));
};

export const createThirdPartyNotices = (components) => {
    const sections = [
        'Ocean Brain Third-Party Notices',
        '=================================',
        '',
        'This file is generated from the JavaScript that contributes to the published bundles and tracked static assets.',
        'Each component remains subject to its own license. Corresponding source is available from the exact npm package URL listed below.',
        '',
    ];

    for (const component of components) {
        sections.push(
            '='.repeat(80),
            `${component.name}@${component.version}`,
            `License: ${component.license}`,
            `Bundled in: ${component.bundles.join(', ')}`,
            `Package: ${component.source}`,
            `Corresponding source archive: ${component.sourceArchive}`,
        );

        if (component.author) {
            sections.push(`Author: ${component.author}`);
        }

        if (component.repository) {
            sections.push(`Repository: ${component.repository}`);
        }

        if (component.assetFiles?.length > 0) {
            sections.push(
                ...component.assetFiles.map((asset) => `Bundled asset: ${asset.path} (SHA-256: ${asset.sha256})`),
            );
        }

        for (const document of component.licenseDocuments) {
            sections.push('', `--- ${document.name} ---`);
            if (document.source) {
                sections.push(`License text source: ${document.source}`);
            }
            sections.push('', document.text);
        }

        sections.push('');
    }

    return `${sections.join('\n')}\n`;
};

const KNOWN_SPDX_LICENSE_IDS = new Set([
    '0BSD',
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'BlueOak-1.0.0',
    'ISC',
    'MIT',
    'MIT-0',
    'MPL-2.0',
    'OFL-1.1',
]);

const cycloneDxLicenses = (license) => {
    if (/\s(?:AND|OR|WITH)\s|[()]/.test(license)) {
        return [{ expression: license }];
    }

    if (KNOWN_SPDX_LICENSE_IDS.has(license)) {
        return [{ license: { id: license } }];
    }

    return [{ license: { name: license } }];
};

export const createCycloneDxBom = (cliPackage, components) => {
    const rootPurl = npmPurl(cliPackage.name, cliPackage.version);
    const componentEntries = components.map((component) => {
        const parts = splitPackageName(component.name);
        const purl = npmPurl(component.name, component.version);
        const externalReferences = [{ type: 'source-distribution', url: component.sourceArchive }];

        if (component.repository?.startsWith('http')) {
            externalReferences.push({ type: 'vcs', url: component.repository });
        }

        return {
            type: 'library',
            'bom-ref': purl,
            ...(parts.group ? { group: parts.group } : {}),
            name: parts.name,
            version: component.version,
            scope: 'required',
            purl,
            licenses: cycloneDxLicenses(component.license),
            externalReferences,
            properties: [
                { name: 'ocean-brain:bundled-package-name', value: component.name },
                { name: 'ocean-brain:bundled-in', value: component.bundles.join(',') },
                {
                    name: 'ocean-brain:license-files',
                    value: component.licenseDocuments.map((document) => document.name).join(',') || 'not-included-upstream',
                },
                ...(component.assetFiles?.length > 0
                    ? [{
                        name: 'ocean-brain:bundled-assets',
                        value: component.assetFiles
                            .map((asset) => `${asset.path}#sha256=${asset.sha256}`)
                            .join(','),
                    }]
                    : []),
            ],
        };
    });

    return {
        $schema: 'http://cyclonedx.org/schema/bom-1.6.schema.json',
        bomFormat: 'CycloneDX',
        specVersion: '1.6',
        version: 1,
        metadata: {
            component: {
                type: 'application',
                'bom-ref': rootPurl,
                name: cliPackage.name,
                version: cliPackage.version,
                purl: rootPurl,
            },
            properties: [{
                name: 'ocean-brain:sbom-scope',
                value: 'JavaScript embedded by esbuild and Rollup plus tracked static assets; package.json dependencies remain external runtime components. Dependency relationships are unspecified.',
            }],
        },
        components: componentEntries,
    };
};

export const generateBundleMetadata = ({
    bundles,
    cliPackageJsonPath,
    noticesPath,
    sbomPath,
    assetManifests = [],
    licenseOverridesPath,
    cleanupMetafiles = true,
}) => {
    const cliPackage = readJson(cliPackageJsonPath);
    const components = collectBundledComponents(bundles, { assetManifests, licenseOverridesPath });

    writeFileSync(noticesPath, createThirdPartyNotices(components), 'utf8');
    writeFileSync(sbomPath, `${JSON.stringify(createCycloneDxBom(cliPackage, components), null, 2)}\n`, 'utf8');

    if (cleanupMetafiles) {
        for (const bundle of bundles) {
            rmSync(bundle.metafilePath, { force: true });
        }
    }

    return components;
};

const main = () => {
    const cliDir = path.join(rootDir, 'packages', 'cli');
    const clientDir = path.join(rootDir, 'packages', 'client');
    const bundles = [
        {
            name: 'client',
            packageDir: clientDir,
            metafilePath: path.join(clientDir, 'dist', 'bundle-metafile.json'),
        },
        {
            name: 'cli',
            packageDir: cliDir,
            metafilePath: path.join(cliDir, 'dist', 'metafile-esm.json'),
        },
        {
            name: 'server',
            packageDir: path.join(rootDir, 'packages', 'server'),
            metafilePath: path.join(rootDir, 'packages', 'server', 'dist', 'metafile-esm.json'),
        },
    ];
    const components = generateBundleMetadata({
        bundles,
        cliPackageJsonPath: path.join(cliDir, 'package.json'),
        noticesPath: path.join(cliDir, 'THIRD_PARTY_NOTICES.txt'),
        sbomPath: path.join(cliDir, 'SBOM.cdx.json'),
        assetManifests: [{
            packageDir: clientDir,
            manifestPath: path.join(clientDir, 'third-party-assets.json'),
        }],
        licenseOverridesPath: path.join(__dirname, 'bundle-license-overrides.json'),
    });

    console.log(`Generated third-party notices and CycloneDX SBOM for ${components.length} bundled components.`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
