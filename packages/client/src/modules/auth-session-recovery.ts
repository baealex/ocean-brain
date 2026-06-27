import type { AuthSessionResponse } from '@baejino/auth';
import { redirectToLogin } from './auth-navigation';

const AUTH_SESSION_GENERATION_HEADER = 'X-Ocean-Brain-Session-Generation';

type RedirectLocation = Pick<Location, 'reload'>;
export type SessionRecoveryResult = 'active' | 'expired' | 'reloading' | 'unavailable';

let reloadInProgress = false;
let observedSessionGeneration: string | undefined;

export const resetAuthSessionRecoveryStateForTests = () => {
    reloadInProgress = false;
    observedSessionGeneration = undefined;
};

export const isExpiredAuthSession = (session: AuthSessionResponse) => {
    return Boolean(session.authRequired && !session.authenticated);
};

export const rememberSessionGeneration = (response: Pick<Response, 'headers'>) => {
    const generation = response.headers.get(AUTH_SESSION_GENERATION_HEADER);

    if (!generation) {
        return false;
    }

    if (!observedSessionGeneration) {
        observedSessionGeneration = generation;
        return false;
    }

    if (observedSessionGeneration === generation) {
        return false;
    }

    observedSessionGeneration = generation;
    return true;
};

export const reloadForSessionGenerationChange = (location: RedirectLocation = window.location) => {
    if (reloadInProgress) {
        return;
    }

    reloadInProgress = true;
    location.reload();
};

export const redirectToLoginIfSessionExpired = async (
    fetchImpl: typeof fetch = fetch,
): Promise<SessionRecoveryResult> => {
    const response = await fetchImpl('/api/auth/session').catch(() => undefined);

    if (!response?.ok) {
        return 'unavailable';
    }

    const generationChanged = rememberSessionGeneration(response);
    const session = (await response.json()) as AuthSessionResponse;

    if (isExpiredAuthSession(session)) {
        redirectToLogin();
        return 'expired';
    }

    if (generationChanged) {
        reloadForSessionGenerationChange();
        return 'reloading';
    }

    return 'active';
};
