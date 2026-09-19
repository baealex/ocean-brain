export const INTEGRATION_APP_BRIDGE_VERSION = 1;
export const DEFAULT_INTEGRATION_APP_LOCATION = '/';
export const MAX_INTEGRATION_APP_LOCATION_LENGTH = 2048;

const APP_LOCATION_BASE = 'https://integration-app.invalid';

export const normalizeIntegrationAppLocation = (value: unknown): string | undefined => {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > MAX_INTEGRATION_APP_LOCATION_LENGTH ||
        !value.startsWith('/') ||
        value.startsWith('//') ||
        value.includes('\\') ||
        [...value].some((character) => {
            const code = character.charCodeAt(0);
            return code <= 31 || code === 127;
        })
    ) {
        return undefined;
    }

    const rawPath = value.split(/[?#]/, 1)[0];
    for (const segment of rawPath.split('/')) {
        let decoded = segment;
        for (let pass = 0; pass < 3; pass += 1) {
            let next: string;
            try {
                next = decodeURIComponent(decoded);
            } catch {
                return undefined;
            }
            if (next === '.' || next === '..' || next.includes('/') || next.includes('\\')) return undefined;
            if (next === decoded) break;
            decoded = next;
        }
    }

    try {
        const url = new URL(value, APP_LOCATION_BASE);
        if (url.origin !== APP_LOCATION_BASE) return undefined;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return undefined;
    }
};

export const resolveIntegrationAppSource = (sourceRoot: string, location: string) => {
    const normalized = normalizeIntegrationAppLocation(location) ?? DEFAULT_INTEGRATION_APP_LOCATION;
    const source = new URL(sourceRoot);
    if (normalized === DEFAULT_INTEGRATION_APP_LOCATION) return source.href;

    const appLocation = new URL(normalized, APP_LOCATION_BASE);
    if (appLocation.pathname !== '/') {
        const rootPath = source.pathname.endsWith('/') ? source.pathname : `${source.pathname}/`;
        source.pathname = `${rootPath}${appLocation.pathname.slice(1)}`;
    }
    source.search = appLocation.search;
    source.hash = appLocation.hash;
    return source.href;
};
