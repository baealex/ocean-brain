import axios, { type InternalAxiosRequestConfig } from 'axios';
import { redirectToLoginIfSessionExpired, type SessionRecoveryResult } from './auth-session-recovery';

const CSRF_RETRY_FLAG = '__oceanBrainCsrfRetry';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
    [CSRF_RETRY_FLAG]?: boolean;
};

let csrfRefreshPromise: Promise<SessionRecoveryResult> | undefined;

export const resetAuthCsrfRetryStateForTests = () => {
    csrfRefreshPromise = undefined;
};

export const isCsrfTokenInvalidFailure = (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 403) {
        return false;
    }

    return (error.response.data as { code?: unknown } | undefined)?.code === 'CSRF_TOKEN_INVALID';
};

export const shouldRetryCsrfRequest = (error: unknown) => {
    if (!isCsrfTokenInvalidFailure(error) || !axios.isAxiosError(error)) {
        return false;
    }

    const config = error.config as RetriableRequestConfig | undefined;

    return Boolean(config && !config[CSRF_RETRY_FLAG]);
};

const refreshSessionForCsrfRetry = () => {
    csrfRefreshPromise ??= redirectToLoginIfSessionExpired().finally(() => {
        csrfRefreshPromise = undefined;
    });

    return csrfRefreshPromise;
};

const deleteHeader = (headers: RetriableRequestConfig['headers'], headerName: string) => {
    if (!headers) {
        return;
    }

    const maybeAxiosHeaders = headers as { delete?: (name: string) => void };

    if (typeof maybeAxiosHeaders.delete === 'function') {
        maybeAxiosHeaders.delete(headerName);
        return;
    }

    delete (headers as Record<string, unknown>)[headerName];
};

const clearStaleCsrfHeader = (config: RetriableRequestConfig) => {
    deleteHeader(config.headers, 'X-XSRF-TOKEN');
    deleteHeader(config.headers, 'x-xsrf-token');
};

export const retryCsrfRequest = async (error: unknown) => {
    if (!shouldRetryCsrfRequest(error) || !axios.isAxiosError(error)) {
        return Promise.reject(error);
    }

    const config = error.config as RetriableRequestConfig;
    config[CSRF_RETRY_FLAG] = true;

    const recoveryResult = await refreshSessionForCsrfRetry();

    if (recoveryResult !== 'active') {
        return Promise.reject(error);
    }

    clearStaleCsrfHeader(config);
    return axios.request(config);
};
