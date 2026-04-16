import { describe, expect, it } from 'vitest';

import { buildAuthLoginPath, isExpiredAuthSession, shouldRedirectToLogin } from './auth-redirect';

const createAxiosError = (status: number, url = '/graphql') => ({
    isAxiosError: true,
    config: { url },
    response: { status },
});

describe('auth-redirect', () => {
    it('builds a login path that preserves the current route', () => {
        expect(
            buildAuthLoginPath({
                pathname: '/notes/123',
                search: '?tab=edit',
                hash: '#title',
            }),
        ).toBe('/auth/login?next=%2Fnotes%2F123%3Ftab%3Dedit%23title');
    });

    it('redirects API and GraphQL 401 responses to login', () => {
        expect(shouldRedirectToLogin(createAxiosError(401))).toBe(true);
    });

    it('does not redirect non-auth failures', () => {
        expect(shouldRedirectToLogin(createAxiosError(500))).toBe(false);
    });

    it('does not redirect auth route failures', () => {
        expect(shouldRedirectToLogin(createAxiosError(401, '/auth/login'))).toBe(false);
    });

    it('detects expired password sessions', () => {
        expect(isExpiredAuthSession({ authRequired: true, authenticated: false })).toBe(true);
        expect(isExpiredAuthSession({ authRequired: true, authenticated: true })).toBe(false);
        expect(isExpiredAuthSession({ authRequired: false, authenticated: false })).toBe(false);
    });
});
