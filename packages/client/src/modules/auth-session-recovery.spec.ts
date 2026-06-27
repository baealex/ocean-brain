import { describe, expect, it } from 'vitest';

import {
    isExpiredAuthSession,
    rememberSessionGeneration,
    resetAuthSessionRecoveryStateForTests,
} from './auth-session-recovery';

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
});
