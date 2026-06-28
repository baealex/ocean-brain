import { describe, expect, it } from 'vitest';

import { isCsrfTokenInvalidFailure, shouldRetryCsrfRequest } from './auth-csrf-retry';

const createAxiosError = (status: number, url = '/graphql', data?: unknown, config?: Record<string, unknown>) => ({
    isAxiosError: true,
    config: { url, ...config },
    response: { status, data },
});

describe('auth-csrf-retry', () => {
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
});
