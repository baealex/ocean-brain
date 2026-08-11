import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    buildAuthLoginPath,
    redirectToLogin,
    resetAuthNavigationStateForTests,
    shouldRedirectToLogin,
} from './auth-navigation';

const createAxiosError = (status: number, url = '/graphql') => ({
    isAxiosError: true,
    config: { url },
    response: { status },
});

describe('auth-navigation', () => {
    beforeEach(() => {
        resetAuthNavigationStateForTests();
    });

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

    it('redirects to login once while preserving the current route', () => {
        const location = {
            pathname: '/notes/123',
            search: '?tab=edit',
            hash: '#title',
            assign: vi.fn(),
        };

        redirectToLogin(location);
        redirectToLogin(location);

        expect(location.assign).toHaveBeenCalledTimes(1);
        expect(location.assign).toHaveBeenCalledWith('/login?next=%2Fnotes%2F123%3Ftab%3Dedit%23title');
    });

    it('does not redirect when the browser is already on the login page', () => {
        const location = {
            pathname: '/login',
            search: '',
            hash: '',
            assign: vi.fn(),
        };

        redirectToLogin(location);

        expect(location.assign).not.toHaveBeenCalled();
    });
});
