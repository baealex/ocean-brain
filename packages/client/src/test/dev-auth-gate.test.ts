import { describe, expect, it, vi } from 'vitest';

import {
    buildDevAuthLoginRedirect,
    createDevAuthGateMiddleware,
    isPasswordModeEnabled,
    shouldBypassDevAuthGate
} from '../dev-auth-gate';

describe('dev auth gate', () => {
    it('enables password mode when password env or explicit password mode is set', () => {
        expect(isPasswordModeEnabled({ OCEAN_BRAIN_PASSWORD: 'secret' })).toBe(true);

        expect(isPasswordModeEnabled({ OCEAN_BRAIN_AUTH_MODE: 'password' })).toBe(true);

        expect(isPasswordModeEnabled({
            OCEAN_BRAIN_AUTH_MODE: 'disabled',
            OCEAN_BRAIN_PASSWORD: 'secret'
        })).toBe(false);
    });

    it('bypasses vite internals and proxied server paths', () => {
        expect(shouldBypassDevAuthGate('/@vite/client')).toBe(true);
        expect(shouldBypassDevAuthGate('/src/main.tsx')).toBe(true);
        expect(shouldBypassDevAuthGate('/api/auth/session')).toBe(true);
        expect(shouldBypassDevAuthGate('/graphql')).toBe(true);
        expect(shouldBypassDevAuthGate('/notes')).toBe(false);
    });

    it('builds a login redirect that preserves the original dev url', () => {
        expect(buildDevAuthLoginRedirect('http://localhost:5173/notes?tag=1')).toBe(
            '/auth/login?next=http%3A%2F%2Flocalhost%3A5173%2Fnotes%3Ftag%3D1'
        );
    });

    it('redirects html requests to login when password mode is enabled and session is unauthenticated', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                authRequired: true,
                authenticated: false
            })
        });
        const middleware = createDevAuthGateMiddleware({
            backendOrigin: 'http://localhost:6683',
            enabled: true,
            fetchImpl: fetchImpl as unknown as typeof fetch
        });
        const response = {
            statusCode: 200,
            headers: {} as Record<string, string>,
            setHeader(name: string, value: string) {
                this.headers[name] = value;
            },
            end: vi.fn()
        };
        const next = vi.fn();

        await middleware({
            method: 'GET',
            originalUrl: '/notes',
            headers: {
                accept: 'text/html',
                host: 'localhost:5173'
            }
        }, response, next);

        expect(fetchImpl).toHaveBeenCalledWith('http://localhost:6683/api/auth/session', { headers: {} });
        expect(response.statusCode).toBe(303);
        expect(response.headers.Location).toBe('/auth/login?next=http%3A%2F%2Flocalhost%3A5173%2Fnotes');
        expect(next).not.toHaveBeenCalled();
    });

    it('allows html requests through when the backend session is authenticated', async () => {
        const middleware = createDevAuthGateMiddleware({
            backendOrigin: 'http://localhost:6683',
            enabled: true,
            fetchImpl: vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    authRequired: true,
                    authenticated: true
                })
            }) as unknown as typeof fetch
        });
        const response = {
            statusCode: 200,
            setHeader: vi.fn(),
            end: vi.fn()
        };
        const next = vi.fn();

        await middleware({
            method: 'GET',
            originalUrl: '/notes',
            headers: {
                accept: 'text/html',
                host: 'localhost:5173'
            }
        }, response, next);

        expect(next).toHaveBeenCalledOnce();
        expect(response.end).not.toHaveBeenCalled();
    });
});
