import axios from 'axios';

export interface ManagedAppAccessGrant {
    installationId: string;
    token: string;
    expiresAt: string;
}

export const issueManagedAppAccess = async (installationId: string, signal?: AbortSignal) =>
    (
        await axios.post<ManagedAppAccessGrant>(
            `/api/app-gateway/installations/${encodeURIComponent(installationId)}/access`,
            undefined,
            { signal },
        )
    ).data;
