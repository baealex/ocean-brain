import { afterEach, describe, expect, it } from 'vitest';
import {
    SKETCHBOOK_DARK_THEME_ID,
    SKETCHBOOK_LIGHT_THEME_ID,
    STUDIO_DARK_THEME_ID,
    STUDIO_LIGHT_THEME_ID,
} from '~/themes/builtin-themes';
import {
    APPEARANCE_STORAGE_KEY,
    applyThemeToDom,
    createPortableThemePackage,
    createThemeRegistry,
    hasStoredAppearancePreferences,
    loadAppearancePreferences,
    loadInstalledThemePackages,
    normalizePreferredThemes,
    resolveAppliedTheme,
    saveAppearancePreferences,
    saveInstalledThemePackages,
    THEME_PACKAGES_STORAGE_KEY,
    upsertInstalledThemePackage,
} from './theme-runtime';

const importedPackage = {
    schemaVersion: 1 as const,
    id: 'example.moss',
    name: 'Moss',
    version: '1.0.0',
    themes: [
        {
            id: 'light',
            label: 'Moss Light',
            appearance: 'light' as const,
            variables: {
                '--page-bg': '#f7fff7',
                '--surface': '#ffffff',
                '--fg-default': '#172217',
            },
        },
        {
            id: 'dark',
            label: 'Moss Dark',
            appearance: 'dark' as const,
        },
    ],
};

describe('theme-runtime', () => {
    afterEach(() => {
        localStorage.clear();
        document.documentElement.className = '';
        document.documentElement.removeAttribute('data-theme-id');
        document.documentElement.removeAttribute('data-theme-texture');
        document.documentElement.removeAttribute('style');
    });

    it('migrates the existing explicit theme when appearance settings are absent', () => {
        const preferences = loadAppearancePreferences('dark');

        expect(preferences).toEqual({
            version: 1,
            colorMode: 'dark',
            preferredThemes: {
                light: STUDIO_LIGHT_THEME_ID,
                dark: STUDIO_DARK_THEME_ID,
            },
            overrides: {},
        });
    });

    it('falls back safely when persisted preferences are malformed', () => {
        localStorage.setItem(APPEARANCE_STORAGE_KEY, '{');

        const preferences = loadAppearancePreferences(null);

        expect(preferences.colorMode).toBe('system');
        expect(preferences.preferredThemes.light).toBe(STUDIO_LIGHT_THEME_ID);
    });

    it('round-trips valid appearance preferences', () => {
        const preferences = {
            version: 1 as const,
            colorMode: 'system' as const,
            preferredThemes: {
                light: SKETCHBOOK_LIGHT_THEME_ID,
                dark: SKETCHBOOK_DARK_THEME_ID,
            },
            overrides: {
                [SKETCHBOOK_LIGHT_THEME_ID]: { '--accent-primary': '#f0c45c' },
            },
        };

        saveAppearancePreferences(preferences);

        expect(loadAppearancePreferences(null)).toEqual(preferences);
    });

    it('loads only valid non-built-in installed packages', () => {
        saveInstalledThemePackages([importedPackage]);
        const payload = JSON.parse(localStorage.getItem(THEME_PACKAGES_STORAGE_KEY) ?? '{}');
        payload.packages.push({ ...importedPackage, id: 'ocean-brain.studio' });
        payload.packages.push({ ...importedPackage, schemaVersion: 2 });
        localStorage.setItem(THEME_PACKAGES_STORAGE_KEY, JSON.stringify(payload));

        const installed = loadInstalledThemePackages();

        expect(installed).toEqual([importedPackage]);
    });

    it('updates an installed package without duplicating it', () => {
        const updated = { ...importedPackage, version: '1.1.0' };

        const installed = upsertInstalledThemePackage([importedPackage], updated);

        expect(installed).toHaveLength(1);
        expect(installed[0].version).toBe('1.1.0');
    });

    it('falls back to Studio when a preferred theme is missing or has the wrong appearance', () => {
        const registry = createThemeRegistry([importedPackage]);

        const missing = resolveAppliedTheme(registry, 'missing.theme/light', 'light', {
            '--accent-primary': '#ff0000',
        });
        const wrongAppearance = resolveAppliedTheme(registry, STUDIO_DARK_THEME_ID, 'light');

        expect(missing.fullId).toBe(STUDIO_LIGHT_THEME_ID);
        expect(missing.variables['--accent-primary']).toBeUndefined();
        expect(wrongAppearance.fullId).toBe(STUDIO_LIGHT_THEME_ID);
    });

    it('repairs missing or wrong-appearance preferred theme IDs', () => {
        const registry = createThemeRegistry([importedPackage]);

        const preferredThemes = normalizePreferredThemes(registry, {
            light: 'missing.theme/light',
            dark: `${importedPackage.id}/light`,
        });

        expect(preferredThemes).toEqual({
            light: STUDIO_LIGHT_THEME_ID,
            dark: STUDIO_DARK_THEME_ID,
        });
    });

    it('repairs mixed preferences to one complete theme set', () => {
        const registry = createThemeRegistry();

        const preferredThemes = normalizePreferredThemes(registry, {
            light: STUDIO_LIGHT_THEME_ID,
            dark: SKETCHBOOK_DARK_THEME_ID,
        });

        expect(preferredThemes).toEqual({
            light: SKETCHBOOK_LIGHT_THEME_ID,
            dark: SKETCHBOOK_DARK_THEME_ID,
        });
    });

    it('ignores persisted overrides that break critical contrast', () => {
        const registry = createThemeRegistry();

        const theme = resolveAppliedTheme(registry, STUDIO_LIGHT_THEME_ID, 'light', {
            '--fg-default': '#f7f8fa',
        });

        expect(theme.variables['--fg-default']).toBeUndefined();
    });

    it('applies a theme atomically and removes variables left by the previous theme', () => {
        const registry = createThemeRegistry();
        const sketchbook = resolveAppliedTheme(registry, SKETCHBOOK_LIGHT_THEME_ID, 'light');
        const studio = resolveAppliedTheme(registry, STUDIO_LIGHT_THEME_ID, 'light');

        applyThemeToDom(sketchbook);
        expect(document.documentElement.dataset.themeId).toBe(SKETCHBOOK_LIGHT_THEME_ID);
        expect(document.documentElement.dataset.themeTexture).toBe('paper');
        expect(document.documentElement.style.getPropertyValue('--page-bg')).toBe('#fdf8f3');

        applyThemeToDom(studio);
        expect(document.documentElement.style.getPropertyValue('--page-bg')).toBe('');
        expect(document.documentElement.dataset.themeTexture).toBe('none');
    });

    it('exports built-in overrides as an installable custom package', () => {
        const registry = createThemeRegistry();

        const portable = createPortableThemePackage(registry, STUDIO_LIGHT_THEME_ID, {
            [STUDIO_LIGHT_THEME_ID]: { '--accent-primary': '#c08040' },
        });

        expect(portable?.id).toMatch(/^local\.ocean-brain-studio-custom-[a-z0-9]+$/);
        expect(portable?.$schema).toMatch(/^https:\/\//);
        expect(portable?.themes[0].variables?.['--accent-primary']).toBe('#c08040');
    });

    it('gives different customized exports distinct fork identities', () => {
        const registry = createThemeRegistry();

        const amber = createPortableThemePackage(registry, STUDIO_LIGHT_THEME_ID, {
            [STUDIO_LIGHT_THEME_ID]: { '--accent-primary': '#c08040' },
        });
        const blue = createPortableThemePackage(registry, STUDIO_LIGHT_THEME_ID, {
            [STUDIO_LIGHT_THEME_ID]: { '--accent-primary': '#4060c0' },
        });

        expect(amber?.id).not.toBe(blue?.id);
    });

    it('forks a customized imported package without replacing its source identity', () => {
        const registry = createThemeRegistry([importedPackage]);
        const themeId = `${importedPackage.id}/light`;

        const customized = createPortableThemePackage(registry, themeId, {
            [themeId]: { '--accent-primary': '#406040' },
        });
        const unchanged = createPortableThemePackage(registry, themeId, {});

        expect(customized?.id).toMatch(/^local\.example-moss-custom-[a-z0-9]+$/);
        expect(customized?.version).toBe('1.0.0');
        expect(unchanged?.id).toBe(importedPackage.id);
        expect(unchanged?.version).toBe(importedPackage.version);
    });

    it('detects existing appearance data without parsing or replacing future versions', () => {
        localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ version: 2 }));

        expect(hasStoredAppearancePreferences()).toBe(true);
        expect(loadAppearancePreferences(null).version).toBe(1);
        expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}').version).toBe(2);
    });
});
