import { createHash, randomBytes } from 'node:crypto';

export const APP_GATEWAY_ACCESS_PROTOCOL_PREFIX = 'ocean-brain.access.';
export const APP_GATEWAY_ACCESS_COOKIE_NAME = 'ocean-brain.app-access';
export const APP_GATEWAY_ACCESS_HEADER = 'x-ocean-brain-app-access';
export const APP_GATEWAY_PROTOCOL = 'ocean-brain.app';
export const APP_GATEWAY_ACCESS_TTL_MS = 5 * 60 * 1000;

const MAX_ACTIVE_ACCESS_TOKENS = 1_024;

interface AccessGrant {
    installationId: string;
    expiresAt: number;
}

const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

export const extractAppGatewayAccessToken = (protocolHeader: string | string[] | undefined) => {
    const protocols = (Array.isArray(protocolHeader) ? protocolHeader.join(',') : (protocolHeader ?? ''))
        .split(',')
        .map((protocol) => protocol.trim());
    const accessProtocol = protocols.find((protocol) => protocol.startsWith(APP_GATEWAY_ACCESS_PROTOCOL_PREFIX));
    const token = accessProtocol?.slice(APP_GATEWAY_ACCESS_PROTOCOL_PREFIX.length);
    return token || undefined;
};

export const extractAppGatewayAccessCookie = (cookieHeader: string | undefined) => {
    const cookie = cookieHeader
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${APP_GATEWAY_ACCESS_COOKIE_NAME}=`));
    return cookie?.slice(APP_GATEWAY_ACCESS_COOKIE_NAME.length + 1) || undefined;
};

export const selectAppGatewayProtocol = (protocols: Set<string>) => {
    for (const protocol of protocols) {
        if (!protocol.startsWith(APP_GATEWAY_ACCESS_PROTOCOL_PREFIX)) return protocol;
    }
    return false;
};

export const createAppGatewayAccessService = () => {
    const grants = new Map<string, AccessGrant>();

    const prune = (now: number) => {
        for (const [tokenHash, grant] of grants) {
            if (grant.expiresAt <= now) grants.delete(tokenHash);
        }
        while (grants.size >= MAX_ACTIVE_ACCESS_TOKENS) {
            const oldestTokenHash = grants.keys().next().value;
            if (!oldestTokenHash) break;
            grants.delete(oldestTokenHash);
        }
    };

    return {
        issue(installationId: string) {
            const now = Date.now();
            prune(now);
            const token = randomBytes(32).toString('base64url');
            const expiresAt = now + APP_GATEWAY_ACCESS_TTL_MS;
            grants.set(hashToken(token), { installationId, expiresAt });
            return { token, expiresAt: new Date(expiresAt).toISOString() };
        },
        verify(installationId: string, token: string | undefined) {
            if (!token) return false;
            const now = Date.now();
            const tokenHash = hashToken(token);
            const grant = grants.get(tokenHash);
            if (!grant || grant.expiresAt <= now) {
                grants.delete(tokenHash);
                return false;
            }
            return grant.installationId === installationId;
        },
    };
};

export type AppGatewayAccessService = ReturnType<typeof createAppGatewayAccessService>;
