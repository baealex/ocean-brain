import { describe, expect, it, vi } from 'vitest';

import {
    isExpiredAuthSession,
    redirectToLoginIfSessionExpired,
    rememberSessionGeneration,
    resetAuthSessionRecoveryStateForTests,
} from './auth-session-recovery';
import { isLocalOnlyDemoMode } from './demo-mode';

vi.mock('./demo-mode', () => ({ isLocalOnlyDemoMode: vi.fn(() => false) }));

const createSessionGenerationResponse = (generation?: string) => ({
    headers: {
        get: (name: string) => (name === 'X-Ocean-Brain-Session-Generation' ? (generation ?? null) : null),
    },
});

describe('auth-session-recovery', () => {
    it('detects expired password sessions', () => {
        expect(isExpiredAuthSession({ authRequired: true, authenticated: false })).toBe(true);
        expect(isExpiredAuthSession({ authRequired: true, authenticated: true })).toBe(false);
        expect(isExpiredAuthSession({ authRequired: false, authenticated: false })).toBe(false);
    });

    it('tracks session generation changes after the first observed value', () => {
        resetAuthSessionRecoveryStateForTests();

        expect(rememberSessionGeneration(createSessionGenerationResponse())).toBe(false);
        expect(rememberSessionGeneration(createSessionGenerationResponse('boot-1'))).toBe(false);
        expect(rememberSessionGeneration(createSessionGenerationResponse('boot-1'))).toBe(false);
        expect(rememberSessionGeneration(createSessionGenerationResponse('boot-2'))).toBe(true);
        expect(rememberSessionGeneration(createSessionGenerationResponse('boot-2'))).toBe(false);
    });

    it('does not request the auth session in the local-only demo', async () => {
        vi.mocked(isLocalOnlyDemoMode).mockReturnValue(true);
        const fetchImpl = vi.fn();

        await redirectToLoginIfSessionExpired(fetchImpl);

        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
