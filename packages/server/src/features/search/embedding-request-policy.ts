import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type ResolveEmbeddingHost = (hostname: string) => Promise<string[]>;

interface EmbeddingRequestPolicyOptions {
    allowedOrigins?: readonly string[];
    resolveHost?: ResolveEmbeddingHost;
}

type Ipv4Kind = 'public' | 'private' | 'loopback' | 'blocked';
type IpKind = Ipv4Kind | 'ipv6-public' | 'ipv6-private';

const normalizeHostname = (hostname: string) => {
    const normalized = hostname.trim().toLowerCase();
    return normalized.startsWith('[') && normalized.endsWith(']') ? normalized.slice(1, -1) : normalized;
};

const classifyIpv4 = (address: string): Ipv4Kind => {
    const octets = address.split('.').map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return 'blocked';
    }

    const [a, b] = octets;
    if (a === 127) return 'loopback';
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'private';
    if (a === 100 && b >= 64 && b <= 127) return 'private';
    if (
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 192 && b === 0) ||
        (a === 192 && b === 2) ||
        (a === 198 && (b === 18 || b === 19 || b === 51)) ||
        (a === 203 && b === 0) ||
        a >= 224
    ) {
        return 'blocked';
    }
    return 'public';
};

const classifyIp = (address: string): IpKind => {
    const normalized = normalizeHostname(address);
    if (isIP(normalized) === 4) {
        return classifyIpv4(normalized);
    }

    const lower = normalized.toLowerCase();
    if (lower === '::1') return 'loopback';
    if (
        lower === '::' ||
        lower.startsWith('fe8') ||
        lower.startsWith('fe9') ||
        lower.startsWith('fea') ||
        lower.startsWith('feb')
    ) {
        return 'blocked';
    }
    if (lower.startsWith('fc') || lower.startsWith('fd')) return 'ipv6-private';
    if (lower.startsWith('ff')) return 'blocked';
    if (lower.startsWith('::ffff:')) {
        return classifyIpv4(lower.slice('::ffff:'.length));
    }
    return 'ipv6-public';
};

const defaultResolveHost: ResolveEmbeddingHost = async (hostname) => {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.map(({ address }) => address);
};

const isLoopbackHostname = (hostname: string) => hostname === 'localhost';

export const assertEmbeddingRequestAllowed = async (
    requestUrl: string,
    options: EmbeddingRequestPolicyOptions = {},
) => {
    const url = new URL(requestUrl);
    const hostname = normalizeHostname(url.hostname);
    const allowedOrigins = new Set((options.allowedOrigins ?? []).map((origin) => origin.toLowerCase()));
    const explicitlyAllowed = allowedOrigins.has(url.origin.toLowerCase());

    if (url.username || url.password) {
        throw new Error('Embedding API URL must not contain credentials.');
    }

    if (isLoopbackHostname(hostname)) {
        return;
    }

    const literalVersion = isIP(hostname);
    const addresses = literalVersion ? [hostname] : await (options.resolveHost ?? defaultResolveHost)(hostname);
    if (addresses.length === 0) {
        throw new Error('Embedding API hostname did not resolve to an address.');
    }

    let loopbackOnly = true;
    let hasPublicAddress = false;
    for (const address of addresses) {
        const kind = classifyIp(address);
        if (kind === 'blocked') {
            throw new Error('Embedding API URL resolves to a blocked network address.');
        }
        if (kind !== 'loopback') {
            loopbackOnly = false;
        }
        if (kind === 'public' || kind === 'ipv6-public') {
            hasPublicAddress = true;
        }
        if ((kind === 'private' || kind === 'ipv6-private') && !explicitlyAllowed) {
            throw new Error(
                'Embedding API URL resolves to a private network. Add its origin to OCEAN_BRAIN_EMBEDDING_ALLOWED_ORIGINS to trust it.',
            );
        }
    }

    if (url.protocol !== 'https:' && (hasPublicAddress || (!loopbackOnly && !explicitlyAllowed))) {
        throw new Error('Remote embedding API URLs must use HTTPS.');
    }
};
