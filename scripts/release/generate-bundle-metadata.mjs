#!/usr/bin/env node

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

export const collectBundledComponents = (bundles) => {
    const components = new Map();

    for (const bundle of bundles) {
        const metafile = readJson(bundle.metafilePath);

        for (const input of Object.keys(metafile.inputs ?? {})) {
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

    return [...components.values()]
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
        })
        .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));
};

export const createThirdPartyNotices = (components) => {
    const sections = [
        'Ocean Brain Third-Party Notices',
        '=================================',
        '',
        'This file is generated from the actual esbuild and Rollup input graphs used by the published Ocean Brain CLI.',
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

        if (component.licenseDocuments.length === 0) {
            sections.push(
                '',
                'The npm package did not include a standalone LICENSE, COPYING, or NOTICE file.',
                'The license identifier above comes from that package\'s published package.json; consult the exact source URL for upstream terms.',
            );
        } else {
            for (const document of component.licenseDocuments) {
                sections.push('', `--- ${document.name} ---`, '', document.text);
            }
        }

        sections.push('');
    }

    return `${sections.join('\n')}\n`;
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
            licenses: [{ license: { name: component.license } }],
            externalReferences,
            properties: [
                { name: 'ocean-brain:bundled-package-name', value: component.name },
                { name: 'ocean-brain:bundled-in', value: component.bundles.join(',') },
                {
                    name: 'ocean-brain:license-files',
                    value: component.licenseDocuments.map((document) => document.name).join(',') || 'not-included-upstream',
                },
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
                value: 'JavaScript embedded by esbuild and Rollup; package.json dependencies remain external runtime components.',
            }],
        },
        components: componentEntries,
        dependencies: [
            { ref: rootPurl, dependsOn: componentEntries.map((component) => component['bom-ref']) },
            ...componentEntries.map((component) => ({ ref: component['bom-ref'], dependsOn: [] })),
        ],
    };
};

export const generateBundleMetadata = ({
    bundles,
    cliPackageJsonPath,
    noticesPath,
    sbomPath,
    cleanupMetafiles = true,
}) => {
    const cliPackage = readJson(cliPackageJsonPath);
    const components = collectBundledComponents(bundles);

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
    const bundles = [
        {
            name: 'client',
            packageDir: path.join(rootDir, 'packages', 'client'),
            metafilePath: path.join(rootDir, 'packages', 'client', 'dist', 'bundle-metafile.json'),
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
    });

    console.log(`Generated third-party notices and CycloneDX SBOM for ${components.length} bundled packages.`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
