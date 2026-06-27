import fs from 'fs';
import path from 'path';

import { paths } from '~/paths.js';

export const OCEAN_BRAIN_RELEASES_URL = 'https://github.com/baealex/ocean-brain/releases';

interface MajorMinorVersion {
    major: number;
    minor: number;
}

const normalizeVersion = (version: string) => version.trim().replace(/^v/i, '');

export const parseMajorMinorVersion = (version: string): MajorMinorVersion | null => {
    const match = normalizeVersion(version).match(/^(\d+)\.(\d+)(?:\.\d+)?(?:[-+].*)?$/);

    if (!match) {
        return null;
    }

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
    };
};

export const formatMcpVersionRequirement = (serverVersion: string) => {
    const parsed = parseMajorMinorVersion(serverVersion);
    return parsed ? `${parsed.major}.${parsed.minor}.x` : 'unknown';
};

const readPackageVersion = (packageJsonPath: string) => {
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as { version?: unknown };
        return typeof packageJson.version === 'string' ? packageJson.version : undefined;
    } catch {
        return undefined;
    }
};

const getVersionCandidatePaths = () => {
    return Array.from(
        new Set([
            path.resolve(paths.packageRoot, '..', 'package.json'),
            path.resolve(paths.packageRoot, '..', 'cli', 'package.json'),
            path.resolve(process.cwd(), 'packages', 'cli', 'package.json'),
            path.resolve(process.cwd(), '..', 'cli', 'package.json'),
        ]),
    );
};

export const resolveOceanBrainVersion = () => {
    if (process.env.OCEAN_BRAIN_VERSION) {
        return normalizeVersion(process.env.OCEAN_BRAIN_VERSION);
    }

    for (const candidatePath of getVersionCandidatePaths()) {
        const version = readPackageVersion(candidatePath);
        if (version) {
            return normalizeVersion(version);
        }
    }

    return '0.0.0';
};

export const getOceanBrainVersionInfo = () => {
    const version = resolveOceanBrainVersion();

    return {
        version,
        releaseUrl: OCEAN_BRAIN_RELEASES_URL,
        mcpVersionRequirement: formatMcpVersionRequirement(version),
    };
};
