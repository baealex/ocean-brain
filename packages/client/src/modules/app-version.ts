export const OCEAN_BRAIN_RELEASES_URL = 'https://github.com/baealex/ocean-brain/releases';
export const OCEAN_BRAIN_VERSION = __OCEAN_BRAIN_VERSION__;

export const formatVersionLabel = (version: string) => {
    return /^\d+\.\d+\.\d+/.test(version) ? `v${version}` : version;
};

export const formatMcpVersionRequirement = (version: string) => {
    const match = version.match(/^(\d+)\.(\d+)(?:\.\d+)?(?:[-+].*)?$/);
    return match ? `${match[1]}.${match[2]}.x` : 'unknown';
};
