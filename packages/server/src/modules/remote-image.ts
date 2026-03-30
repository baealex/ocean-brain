import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface RemoteImage {
    buffer: Buffer;
    contentType: string;
    extension: string;
}

export interface RemoteImageFetchOptions {
    fetchImpl?: typeof fetch;
    lookupHostname?: (hostname: string) => Promise<Array<{ address: string }>>;
    maxBytes?: number;
    timeoutMs?: number;
}

export class RemoteImageFetchError extends Error {
    public readonly code: string;
    public readonly status: number;

    constructor(code: string, status: number, message: string) {
        super(message);
        this.name = 'RemoteImageFetchError';
        this.code = code;
        this.status = status;
    }
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;
const SUPPORTED_IMAGE_TYPES = new Map([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
    ['image/bmp', 'bmp'],
    ['image/avif', 'avif']
]);

const createRemoteImageFetchError = (code: string, status: number, message: string) => {
    return new RemoteImageFetchError(code, status, message);
};

const normalizeIp = (address: string) => {
    return address.toLowerCase().replace(/^::ffff:/, '');
};

const isBlockedIpv4 = (address: string) => {
    const octets = address.split('.').map((segment) => Number(segment));

    if (octets.length !== 4 || octets.some((segment) => Number.isNaN(segment))) {
        return false;
    }

    if (octets[0] === 127 || octets[0] === 10) {
        return true;
    }

    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
        return true;
    }

    if (octets[0] === 192 && octets[1] === 168) {
        return true;
    }

    return octets[0] === 169 && octets[1] === 254;
};

const isBlockedIpv6 = (address: string) => {
    if (address === '::1') {
        return true;
    }

    const firstSegment = address.split(':')[0];

    if (!firstSegment) {
        return false;
    }

    const firstValue = Number.parseInt(firstSegment, 16);

    if (Number.isNaN(firstValue)) {
        return false;
    }

    return (firstValue & 0xfe00) === 0xfc00 || (firstValue & 0xffc0) === 0xfe80;
};

const isBlockedAddress = (address: string) => {
    const normalizedAddress = normalizeIp(address);
    const family = isIP(normalizedAddress);

    if (family === 4) {
        return isBlockedIpv4(normalizedAddress);
    }

    if (family === 6) {
        return isBlockedIpv6(normalizedAddress);
    }

    return false;
};

const assertSafeRemoteUrl = async (
    src: string,
    lookupHostname: NonNullable<RemoteImageFetchOptions['lookupHostname']>
) => {
    let remoteUrl: URL;

    try {
        remoteUrl = new URL(src);
    } catch {
        throw createRemoteImageFetchError('INVALID_REMOTE_URL', 400, 'Remote image URL is invalid.');
    }

    if (!['http:', 'https:'].includes(remoteUrl.protocol)) {
        throw createRemoteImageFetchError('INVALID_REMOTE_URL', 400, 'Remote image URL must use http or https.');
    }

    if (!remoteUrl.hostname || remoteUrl.username || remoteUrl.password) {
        throw createRemoteImageFetchError('INVALID_REMOTE_URL', 400, 'Remote image URL is invalid.');
    }

    if (
        remoteUrl.port
        && !(
            (remoteUrl.protocol === 'http:' && remoteUrl.port === '80')
            || (remoteUrl.protocol === 'https:' && remoteUrl.port === '443')
        )
    ) {
        throw createRemoteImageFetchError('REMOTE_URL_BLOCKED', 403, 'Remote image host is not allowed.');
    }

    if (remoteUrl.hostname.toLowerCase() === 'localhost') {
        throw createRemoteImageFetchError('REMOTE_URL_BLOCKED', 403, 'Remote image host is not allowed.');
    }

    if (isIP(remoteUrl.hostname)) {
        if (isBlockedAddress(remoteUrl.hostname)) {
            throw createRemoteImageFetchError('REMOTE_URL_BLOCKED', 403, 'Remote image host is not allowed.');
        }

        return remoteUrl;
    }

    let addresses: Array<{ address: string }>;

    try {
        addresses = await lookupHostname(remoteUrl.hostname);
    } catch {
        throw createRemoteImageFetchError('REMOTE_FETCH_FAILED', 502, 'Remote image could not be fetched.');
    }

    if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
        throw createRemoteImageFetchError('REMOTE_URL_BLOCKED', 403, 'Remote image host is not allowed.');
    }

    return remoteUrl;
};

const readImageBody = async (response: Response, maxBytes: number) => {
    if (!response.body) {
        throw createRemoteImageFetchError('REMOTE_FETCH_FAILED', 502, 'Remote image response body was empty.');
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        totalBytes += value.byteLength;

        if (totalBytes > maxBytes) {
            await reader.cancel();
            throw createRemoteImageFetchError('REMOTE_IMAGE_TOO_LARGE', 413, 'Remote image exceeded the size limit.');
        }

        chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks);
};

export const fetchRemoteImage = async (
    src: string,
    options: RemoteImageFetchOptions = {}
): Promise<RemoteImage> => {
    const fetchImpl = options.fetchImpl ?? fetch;
    const lookupHostname = options.lookupHostname ?? ((hostname: string) => {
        return dnsLookup(hostname, {
            all: true,
            verbatim: true
        });
    });
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const remoteUrl = await assertSafeRemoteUrl(src, lookupHostname);

    let response: Response;

    try {
        response = await fetchImpl(remoteUrl, {
            method: 'GET',
            redirect: 'error',
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (error) {
        if (error instanceof RemoteImageFetchError) {
            throw error;
        }

        if (
            error instanceof Error
            && (error.name === 'TimeoutError' || error.name === 'AbortError')
        ) {
            throw createRemoteImageFetchError('REMOTE_FETCH_TIMEOUT', 504, 'Remote image fetch timed out.');
        }

        throw createRemoteImageFetchError('REMOTE_FETCH_FAILED', 502, 'Remote image could not be fetched.');
    }

    if (!response.ok) {
        throw createRemoteImageFetchError('REMOTE_FETCH_FAILED', 502, 'Remote image could not be fetched.');
    }

    const contentTypeHeader = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    const extension = SUPPORTED_IMAGE_TYPES.get(contentTypeHeader);

    if (!extension) {
        throw createRemoteImageFetchError(
            'REMOTE_IMAGE_UNSUPPORTED_CONTENT_TYPE',
            415,
            'Remote image content type is not supported.'
        );
    }

    return {
        buffer: await readImageBody(response, maxBytes),
        contentType: contentTypeHeader,
        extension
    };
};
