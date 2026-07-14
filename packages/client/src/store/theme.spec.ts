import { afterEach, describe, expect, it } from 'vitest';
import { APPEARANCE_STORAGE_KEY, THEME_PACKAGES_STORAGE_KEY } from '~/modules/theme-runtime';
import {
    SKETCHBOOK_DARK_THEME_ID,
    SKETCHBOOK_LIGHT_THEME_ID,
    SKETCHBOOK_PACKAGE_ID,
    STUDIO_DARK_THEME_ID,
    STUDIO_LIGHT_THEME_ID,
} from '~/themes/builtin-themes';
import { initializeThemeSystem, useTheme } from './theme';

const originalState = useTheme.getState();

describe('theme store', () => {
    afterEach(() => {
        useTheme.setState(originalState);
        localStorage.clear();
        document.documentElement.className = '';
        document.documentElement.removeAttribute('data-theme-id');
        document.documentElement.removeAttribute('data-theme-texture');
        document.documentElement.removeAttribute('style');
    });

    it('preserves the legacy explicit theme behavior and storage key', () => {
        useTheme.getState().setTheme('dark');

        const state = useTheme.getState();
        expect(state.theme).toBe('dark');
        expect(state.explicitTheme).toBe('dark');
        expect(state.colorMode).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('uses system mode without leaving a legacy explicit preference', () => {
        useTheme.getState().setTheme('dark');

        useTheme.getState().setColorMode('system');

        const state = useTheme.getState();
        expect(state.colorMode).toBe('system');
        expect(state.explicitTheme).toBeNull();
        expect(localStorage.getItem('theme')).toBeNull();
    });

    it('keeps the selected theme set while following the system appearance', () => {
        useTheme.getState().setPreferredThemePackage(SKETCHBOOK_PACKAGE_ID);
        useTheme.getState().setColorMode('system');

        useTheme.getState().setSystemTheme('dark');

        const state = useTheme.getState();
        expect(state.theme).toBe('dark');
        expect(state.explicitTheme).toBeNull();
        expect(state.activeTheme.fullId).toBe(SKETCHBOOK_DARK_THEME_ID);
        expect(state.preferredThemes.light).toBe(SKETCHBOOK_LIGHT_THEME_ID);
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.dataset.themeId).toBe(SKETCHBOOK_DARK_THEME_ID);
    });

    it('selects matching light and dark variants from a theme package', () => {
        useTheme.getState().setPreferredThemePackage(SKETCHBOOK_PACKAGE_ID);

        expect(useTheme.getState().preferredThemes).toEqual({
            light: SKETCHBOOK_LIGHT_THEME_ID,
            dark: SKETCHBOOK_DARK_THEME_ID,
        });
    });

    it('does not select an incomplete theme package', () => {
        useTheme.getState().installThemePackage({
            schemaVersion: 1,
            id: 'example.light-only',
            name: 'Light Only',
            version: '1.0.0',
            themes: [{ id: 'light', label: 'Light Only', appearance: 'light' }],
        });

        useTheme.getState().setPreferredThemePackage('example.light-only');

        expect(useTheme.getState().preferredThemes).toEqual({
            light: STUDIO_LIGHT_THEME_ID,
            dark: STUDIO_DARK_THEME_ID,
        });
    });

    it('preserves the legacy toggle behavior', () => {
        useTheme.getState().setTheme('light');

        useTheme.getState().toggleTheme();

        expect(useTheme.getState().theme).toBe('dark');
        expect(useTheme.getState().explicitTheme).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('applies the resolved system theme before the app renders', () => {
        useTheme.getState().setColorMode('system');
        vi.mocked(window.matchMedia).mockImplementationOnce(() => ({ matches: true }) as MediaQueryList);

        const theme = initializeThemeSystem();

        expect(theme).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.dataset.themeId).toBe(STUDIO_DARK_THEME_ID);
        expect(localStorage.getItem('theme')).toBeNull();
        expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}').colorMode).toBe('system');
    });

    it('does not replace persisted data from a future storage version during initialization', () => {
        const appearance = JSON.stringify({ version: 2, colorMode: 'future' });
        const packages = JSON.stringify({ version: 2, packages: [{ id: 'future.package' }] });
        localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
        localStorage.setItem(THEME_PACKAGES_STORAGE_KEY, packages);

        initializeThemeSystem();

        expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe(appearance);
        expect(localStorage.getItem(THEME_PACKAGES_STORAGE_KEY)).toBe(packages);
    });

    it('previews a theme without changing the saved preference', () => {
        useTheme.getState().setColorMode('light');
        const savedTheme = useTheme.getState().preferredThemes.light;

        useTheme.getState().previewTheme(SKETCHBOOK_LIGHT_THEME_ID);

        expect(useTheme.getState().activeTheme.fullId).toBe(SKETCHBOOK_LIGHT_THEME_ID);
        expect(useTheme.getState().preferredThemes.light).toBe(savedTheme);

        useTheme.getState().cancelThemePreview();
        expect(useTheme.getState().activeTheme.fullId).toBe(savedTheme);
    });

    it('commits the previewed theme as a complete set', () => {
        useTheme.getState().setColorMode('light');
        useTheme.getState().previewTheme(SKETCHBOOK_LIGHT_THEME_ID);

        useTheme.getState().usePreviewedTheme();

        expect(useTheme.getState().previewThemeId).toBeNull();
        expect(useTheme.getState().preferredThemes).toEqual({
            light: SKETCHBOOK_LIGHT_THEME_ID,
            dark: SKETCHBOOK_DARK_THEME_ID,
        });
        expect(useTheme.getState().activeTheme.fullId).toBe(SKETCHBOOK_LIGHT_THEME_ID);
    });

    it('applies and clears sparse user overrides', () => {
        useTheme.getState().setColorMode('light');

        const accepted = useTheme.getState().setThemeOverride(STUDIO_LIGHT_THEME_ID, '--accent-primary', '#c08040');

        expect(accepted).toBe(true);
        expect(useTheme.getState().activeTheme.variables['--accent-primary']).toBe('#c08040');

        useTheme.getState().resetThemeOverrides(STUDIO_LIGHT_THEME_ID);
        expect(useTheme.getState().overrides[STUDIO_LIGHT_THEME_ID]).toBeUndefined();
    });

    it('rejects unsafe override values', () => {
        const accepted = useTheme
            .getState()
            .setThemeOverride(STUDIO_LIGHT_THEME_ID, '--ob-font-ui', 'url(https://tracker.example/font.woff2)');

        expect(accepted).toBe(false);
        expect(useTheme.getState().overrides[STUDIO_LIGHT_THEME_ID]).toBeUndefined();
    });

    it('rejects overrides that break critical text contrast', () => {
        const accepted = useTheme.getState().setThemeOverride(STUDIO_LIGHT_THEME_ID, '--fg-default', '#f7f8fa');

        expect(accepted).toBe(false);
        expect(useTheme.getState().overrides[STUDIO_LIGHT_THEME_ID]).toBeUndefined();
    });

    it('repairs a preferred theme when a package update removes its variant', () => {
        const completePackage = {
            schemaVersion: 1 as const,
            id: 'example.switching',
            name: 'Switching',
            version: '1.0.0',
            themes: [
                { id: 'light', label: 'Switching Light', appearance: 'light' as const },
                { id: 'dark', label: 'Switching Dark', appearance: 'dark' as const },
            ],
        };
        useTheme.getState().installThemePackage(completePackage);
        useTheme.getState().setPreferredThemePackage('example.switching');

        useTheme.getState().installThemePackage({
            ...completePackage,
            version: '2.0.0',
            themes: [{ id: 'dark', label: 'Switching Dark', appearance: 'dark' }],
        });

        expect(useTheme.getState().preferredThemes).toEqual({
            light: STUDIO_LIGHT_THEME_ID,
            dark: STUDIO_DARK_THEME_ID,
        });
        expect(useTheme.getState().activeTheme.fullId).toBe(STUDIO_LIGHT_THEME_ID);
    });
});
