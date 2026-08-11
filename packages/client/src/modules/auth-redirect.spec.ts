import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installAuthRedirectInterceptor, resetAuthRedirectStateForTests } from './auth-redirect';

describe('auth-redirect interceptor', () => {
    beforeEach(() => {
        resetAuthRedirectStateForTests();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('installs one response interceptor even when initialization runs twice', () => {
        const useSpy = vi.spyOn(axios.interceptors.response, 'use').mockReturnValue(7);

        installAuthRedirectInterceptor();
        installAuthRedirectInterceptor();

        expect(useSpy).toHaveBeenCalledTimes(1);
    });

    it('passes successful responses through unchanged', () => {
        let handleSuccess: ((response: unknown) => unknown) | undefined;
        vi.spyOn(axios.interceptors.response, 'use').mockImplementation((onFulfilled) => {
            handleSuccess = onFulfilled as (response: unknown) => unknown;
            return 7;
        });
        const response = { data: { ok: true } };

        installAuthRedirectInterceptor();

        expect(handleSuccess?.(response)).toBe(response);
    });

    it('routes CSRF failures through session recovery and retries the request', async () => {
        let handleError = (error: unknown): Promise<unknown> => Promise.reject(error);
        vi.spyOn(axios.interceptors.response, 'use').mockImplementation((_onFulfilled, onRejected) => {
            handleError = onRejected as (error: unknown) => Promise<unknown>;
            return 7;
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ authRequired: true, authenticated: true }), {
                    status: 200,
                }),
            ),
        );
        const requestSpy = vi.spyOn(axios, 'request').mockResolvedValue({ data: { retried: true } });
        const error = {
            isAxiosError: true,
            config: {
                url: '/graphql',
                headers: {
                    'X-XSRF-TOKEN': 'stale',
                },
            },
            response: {
                status: 403,
                data: { code: 'CSRF_TOKEN_INVALID' },
            },
        };

        installAuthRedirectInterceptor();
        const response = await handleError(error);

        expect(fetch).toHaveBeenCalledWith('/api/auth/session');
        expect(error.config).toEqual({
            url: '/graphql',
            headers: {},
            __oceanBrainCsrfRetry: true,
        });
        expect(requestSpy).toHaveBeenCalledWith(error.config);
        expect(response).toEqual({ data: { retried: true } });
    });

    it('rejects errors that do not require authentication recovery', async () => {
        let handleError = (error: unknown): Promise<unknown> => Promise.reject(error);
        vi.spyOn(axios.interceptors.response, 'use').mockImplementation((_onFulfilled, onRejected) => {
            handleError = onRejected as (error: unknown) => Promise<unknown>;
            return 7;
        });
        const error = {
            isAxiosError: true,
            config: { url: '/graphql' },
            response: { status: 500 },
        };

        installAuthRedirectInterceptor();

        await expect(handleError(error)).rejects.toBe(error);
    });
});
