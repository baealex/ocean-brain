import { describe, expect, it } from 'vitest';

import { buildAuthLoginPath, shouldRedirectToLogin } from './auth-navigation';

const createAxiosError = (status: number, url = '/graphql') => ({
    isAxiosError: true,
    config: { url },
    response: { status },
});

describe('auth-navigation', () => {
    it('builds a login path that preserves the current route', () => {
        const loginPath = buildAuthLoginPath({
            pathname: '/notes/123',
            search: '?tab=edit',
            hash: '#title',
        });

        expect(loginPath).toBe('/login?next=%2Fnotes%2F123%3Ftab%3Dedit%23title');
    });

    it('redirects API and GraphQL 401 responses to login', () => {
        const shouldRedirect = shouldRedirectToLogin(createAxiosError(401));

        expect(shouldRedirect).toBe(true);
    });

    it('does not redirect non-auth failures', () => {
        expect(shouldRedirectToLogin(createAxiosError(500))).toBe(false);
        expect(shouldRedirectToLogin(createAxiosError(403))).toBe(false);
    });

    it('does not redirect auth route failures', () => {
        expect(shouldRedirectToLogin(createAxiosError(401, '/api/auth/login'))).toBe(false);
        expect(shouldRedirectToLogin(createAxiosError(401, '/login'))).toBe(false);
    });
});
