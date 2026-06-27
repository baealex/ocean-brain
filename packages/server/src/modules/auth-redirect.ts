import { sanitizeRedirectPath as sanitizeCommonRedirectPath } from '@baejino/auth';

export const sanitizeRedirectPath = (value: unknown) =>
    sanitizeCommonRedirectPath(value, {
        fallbackPath: '/',
        loginPath: '/login',
        allowedAbsoluteHosts: ['localhost', '127.0.0.1', '::1'],
    });
