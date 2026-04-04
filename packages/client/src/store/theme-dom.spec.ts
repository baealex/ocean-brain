import {
    afterEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import {
    applyThemeClass,
    getStoredTheme,
    initializeTheme,
    resolveTheme
} from './theme-dom';

describe('theme-dom', () => {
    afterEach(() => {
        localStorage.clear();
        document.documentElement.className = '';
        vi.restoreAllMocks();
    });

    it('prefers stored theme over system theme and applies exactly one html class', () => {
        localStorage.setItem('theme', 'dark');

        const applied = initializeTheme({ matchMedia: vi.fn(() => ({ matches: false })) as never });

        expect(applied).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('light')).toBe(false);
        expect(getStoredTheme()).toBe('dark');
    });

    it('falls back to system theme when storage is empty', () => {
        const theme = resolveTheme({
            storedTheme: null,
            systemPrefersDark: true
        });

        expect(theme).toBe('dark');
    });

    it('updates the dom class and local storage together', () => {
        applyThemeClass('light');
        expect(document.documentElement.className).toContain('light');

        applyThemeClass('dark');
        expect(document.documentElement.className).toContain('dark');
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('can apply a system theme without creating a stored preference', () => {
        applyThemeClass('dark', { persist: false });

        expect(document.documentElement.className).toContain('dark');
        expect(localStorage.getItem('theme')).toBeNull();
    });

    it('does not persist the system fallback during initialization', () => {
        const applied = initializeTheme({ matchMedia: vi.fn(() => ({ matches: true })) as never });

        expect(applied).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(localStorage.getItem('theme')).toBeNull();
    });
});
