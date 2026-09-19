import axios from 'axios';

export interface ProxiedAppAccessGrant {
    connectionId: string;
    token: string;
    expiresAt: string;
}

export const issueProxiedAppAccess = async (connectionId: string, signal?: AbortSignal) =>
    (
        await axios.post<ProxiedAppAccessGrant>(
            `/api/app-gateway/connections/${encodeURIComponent(connectionId)}/access`,
            undefined,
            { signal },
        )
    ).data;
