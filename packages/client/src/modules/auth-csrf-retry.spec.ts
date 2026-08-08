import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    isCsrfTokenInvalidFailure,
    resetAuthCsrfRetryStateForTests,
    retryCsrfRequest,
    shouldRetryCsrfRequest,
} from './auth-csrf-retry';
import { redirectToLoginIfSessionExpired } from './auth-session-recovery';

vi.mock('./auth-session-recovery', () => ({
    redirectToLoginIfSessionExpired: vi.fn(),
}));

const createAxiosError = (status: number, url = '/graphql', data?: unknown, config?: Record<string, unknown>) => ({
    isAxiosError: true,
    config: { url, ...config },
    response: { status, data },
});

describe('auth-csrf-retry', () => {
    beforeEach(() => {
        resetAuthCsrfRetryStateForTests();
        vi.mocked(redirectToLoginIfSessionExpired).mockReset();
    });

    it('detects CSRF token failures without treating every 403 as recoverable', () => {
        expect(isCsrfTokenInvalidFailure(createAxiosError(403, '/graphql', { code: 'CSRF_TOKEN_INVALID' }))).toBe(true);
        expect(isCsrfTokenInvalidFailure(createAxiosError(403, '/graphql', { code: 'FORBIDDEN' }))).toBe(false);
        expect(isCsrfTokenInvalidFailure(createAxiosError(401, '/graphql', { code: 'CSRF_TOKEN_INVALID' }))).toBe(
            false,
        );
    });

    it('marks CSRF token failures retryable only before the retry attempt', () => {
        expect(shouldRetryCsrfRequest(createAxiosError(403, '/graphql', { code: 'CSRF_TOKEN_INVALID' }))).toBe(true);
        expect(
            shouldRetryCsrfRequest(
                createAxiosError(403, '/graphql', { code: 'CSRF_TOKEN_INVALID' }, { __oceanBrainCsrfRetry: true }),
            ),
        ).toBe(false);
        expect(shouldRetryCsrfRequest(createAxiosError(403, '/graphql', { code: 'FORBIDDEN' }))).toBe(false);
    });

    it('refreshes the session, clears stale headers, and retries the original request', async () => {
        vi.mocked(redirectToLoginIfSessionExpired).mockResolvedValue('active');
        const requestSpy = vi.spyOn(axios, 'request').mockResolvedValue({ data: { ok: true } });
        const error = createAxiosError(
            403,
            '/graphql',
            { code: 'CSRF_TOKEN_INVALID' },
            {
                headers: {
                    'X-XSRF-TOKEN': 'stale-upper',
                    'x-xsrf-token': 'stale-lower',
                    Accept: 'application/json',
                },
            },
        );

        const response = await retryCsrfRequest(error);

        expect(redirectToLoginIfSessionExpired).toHaveBeenCalledTimes(1);
        expect(error.config).toEqual({
            url: '/graphql',
            headers: {
                Accept: 'application/json',
            },
            __oceanBrainCsrfRetry: true,
        });
        expect(requestSpy).toHaveBeenCalledWith(error.config);
        expect(response).toEqual({ data: { ok: true } });
    });

    it('does not retry when session recovery reports an expired session', async () => {
        vi.mocked(redirectToLoginIfSessionExpired).mockResolvedValue('expired');
        const requestSpy = vi.spyOn(axios, 'request').mockResolvedValue({ data: { ok: true } });
        const error = createAxiosError(403, '/graphql', { code: 'CSRF_TOKEN_INVALID' });

        await expect(retryCsrfRequest(error)).rejects.toBe(error);

        expect(requestSpy).not.toHaveBeenCalled();
    });

    it('shares one session refresh across concurrent CSRF failures', async () => {
        let finishRecovery: ((result: 'active') => void) | undefined;
        vi.mocked(redirectToLoginIfSessionExpired).mockReturnValue(
            new Promise((resolve) => {
                finishRecovery = resolve;
            }),
        );
        const requestSpy = vi.spyOn(axios, 'request').mockResolvedValue({ data: { ok: true } });
        const firstError = createAxiosError(403, '/graphql', { code: 'CSRF_TOKEN_INVALID' });
        const secondError = createAxiosError(403, '/graphql', { code: 'CSRF_TOKEN_INVALID' });

        const firstRetry = retryCsrfRequest(firstError);
        const secondRetry = retryCsrfRequest(secondError);
        finishRecovery?.('active');
        await Promise.all([firstRetry, secondRetry]);

        expect(redirectToLoginIfSessionExpired).toHaveBeenCalledTimes(1);
        expect(requestSpy).toHaveBeenCalledTimes(2);
    });
});
