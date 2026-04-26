import type { AuthSessionResponse } from '@baejino/auth';
import axios from 'axios';

const LOGIN_PATH = '/login';
const AUTH_API_PATH_PREFIX = '/api/auth/';

type RedirectLocation = Pick<Location, 'assign' | 'hash' | 'pathname' | 'search'>;

let authRedirectInterceptorId: number | undefined;
let redirectInProgress = false;

export const buildAuthLoginPath = (location: Pick<Location, 'hash' | 'pathname' | 'search'>) => {
    const nextPath = `${location.pathname || '/'}${location.search}${location.hash}`;

    return `${LOGIN_PATH}?next=${encodeURIComponent(nextPath)}`;
};

export const shouldRedirectToLogin = (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        return false;
    }

    const requestUrl = error.config?.url ?? '';

    return !requestUrl.startsWith(AUTH_API_PATH_PREFIX) && requestUrl !== LOGIN_PATH;
};

export const isExpiredAuthSession = (session: AuthSessionResponse) => {
    return Boolean(session.authRequired && !session.authenticated);
};

export const redirectToLogin = (location: RedirectLocation = window.location) => {
    if (redirectInProgress || location.pathname === LOGIN_PATH) {
        return;
    }

    redirectInProgress = true;
    location.assign(buildAuthLoginPath(location));
};

export const redirectToLoginIfSessionExpired = async (fetchImpl: typeof fetch = fetch) => {
    const response = await fetchImpl('/api/auth/session').catch(() => undefined);

    if (!response?.ok) {
        return;
    }

    const session = (await response.json()) as AuthSessionResponse;

    if (isExpiredAuthSession(session)) {
        redirectToLogin();
    }
};

export const installAuthRedirectInterceptor = () => {
    if (authRedirectInterceptorId !== undefined) {
        return;
    }

    authRedirectInterceptorId = axios.interceptors.response.use(
        (response) => response,
        (error) => {
            if (shouldRedirectToLogin(error)) {
                redirectToLogin();
            }

            return Promise.reject(error);
        },
    );
};
