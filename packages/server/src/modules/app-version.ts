import fs from 'fs';
import path from 'path';

import { paths } from '~/paths.js';

export const OCEAN_BRAIN_RELEASES_URL = 'https://github.com/baealex/ocean-brain/releases';
export const OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER = 'X-Ocean-Brain-MCP-Compatibility-Version';
export const OCEAN_BRAIN_MCP_CLIENT_VERSION_HEADER = 'X-Ocean-Brain-MCP-Client-Version';

interface MajorMinorVersion {
    major: number;
    minor: number;
}

interface PackageMetadata {
    oceanBrain?: {
        mcpCompatibilityVersion?: unknown;
    };
    version?: unknown;
}

export interface OceanBrainVersionInfo {
    version: string;
    releaseUrl: string;
    mcpVersionRequirement: string;
    mcp: {
        compatibilityVersion: string;
        compatibilityRequirement: string;
        compatibilityVersionHeader: string;
        clientVersionHeader: string;
    };
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

export const formatMcpVersionRequirement = (mcpCompatibilityVersion: string) => {
    const parsed = parseMajorMinorVersion(mcpCompatibilityVersion);
    return parsed ? `${parsed.major}.${parsed.minor}.x` : 'unknown';
};

const readPackageMetadata = (packageJsonPath: string): PackageMetadata | undefined => {
    try {
        return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PackageMetadata;
    } catch {
        return undefined;
    }
};

const readPackageVersion = (packageJsonPath: string) => {
    const packageJson = readPackageMetadata(packageJsonPath);
    return typeof packageJson?.version === 'string' ? packageJson.version : undefined;
};

const readPackageMcpCompatibilityVersion = (packageJsonPath: string) => {
    const packageJson = readPackageMetadata(packageJsonPath);
    const version = packageJson?.oceanBrain?.mcpCompatibilityVersion;
    return typeof version === 'string' ? version : undefined;
};

const createMissingMcpCompatibilityVersionError = () =>
    new Error('Ocean Brain MCP compatibility version is required in package metadata.');

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
    for (const candidatePath of getVersionCandidatePaths()) {
        const version = readPackageVersion(candidatePath);
        if (version) {
            return normalizeVersion(version);
        }
    }

    if (process.env.OCEAN_BRAIN_VERSION) {
        return normalizeVersion(process.env.OCEAN_BRAIN_VERSION);
    }

    return '0.0.0';
};

export const resolveMcpCompatibilityVersionFromPaths = (candidatePaths: string[]) => {
    for (const candidatePath of candidatePaths) {
        const version = readPackageMcpCompatibilityVersion(candidatePath);
        if (version) {
            return normalizeVersion(version);
        }
    }

    throw createMissingMcpCompatibilityVersionError();
};

export const resolveMcpCompatibilityVersion = () => resolveMcpCompatibilityVersionFromPaths(getVersionCandidatePaths());

export const buildOceanBrainVersionInfo = ({
    mcpCompatibilityVersion,
    version,
}: {
    mcpCompatibilityVersion: string;
    version: string;
}): OceanBrainVersionInfo => {
    const compatibilityVersion = normalizeVersion(mcpCompatibilityVersion);
    const compatibilityRequirement = formatMcpVersionRequirement(compatibilityVersion);

    return {
        version: normalizeVersion(version),
        releaseUrl: OCEAN_BRAIN_RELEASES_URL,
        mcpVersionRequirement: compatibilityRequirement,
        mcp: {
            compatibilityVersion,
            compatibilityRequirement,
            compatibilityVersionHeader: OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER,
            clientVersionHeader: OCEAN_BRAIN_MCP_CLIENT_VERSION_HEADER,
        },
    };
};

export const getOceanBrainVersionInfo = () =>
    buildOceanBrainVersionInfo({
        version: resolveOceanBrainVersion(),
        mcpCompatibilityVersion: resolveMcpCompatibilityVersion(),
    });
