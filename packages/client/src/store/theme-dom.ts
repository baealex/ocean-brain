import type { Theme } from '~/models/theme.model';

const THEME_STORAGE_KEY = 'theme';
const THEME_QUERY = '(prefers-color-scheme: dark)';

interface ThemeResolverOptions {
    storedTheme: Theme | null;
    systemPrefersDark: boolean;
}

interface ThemeInitializerOptions {
    matchMedia?: (query: string) => { matches: boolean };
}

interface ApplyThemeClassOptions {
    persist?: boolean;
}

function isTheme(value: string | null): value is Theme {
    return value === 'light' || value === 'dark';
}

function getThemeRoot() {
    if (typeof document === 'undefined') {
        return null;
    }

    return document.documentElement;
}

function getThemeStorage() {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function syncThemeClass(theme: Theme) {
    const root = getThemeRoot();

    if (!root) {
        return;
    }

    root.classList.remove('light', 'dark');
    root.classList.add(theme);
}

export function getStoredTheme(): Theme | null {
    let theme: string | null = null;
    try {
        theme = getThemeStorage()?.getItem(THEME_STORAGE_KEY) ?? null;
    } catch {
        return null;
    }

    return isTheme(theme) ? theme : null;
}

export function saveStoredTheme(theme: Theme | null) {
    try {
        if (theme) getThemeStorage()?.setItem(THEME_STORAGE_KEY, theme);
        else getThemeStorage()?.removeItem(THEME_STORAGE_KEY);
    } catch {
        return;
    }
}

export function resolveTheme({ storedTheme, systemPrefersDark }: ThemeResolverOptions): Theme {
    if (storedTheme) {
        return storedTheme;
    }

    return systemPrefersDark ? 'dark' : 'light';
}

export function getSystemTheme(options: ThemeInitializerOptions = {}): Theme {
    const systemPrefersDark = options.matchMedia
        ? options.matchMedia(THEME_QUERY).matches
        : typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia(THEME_QUERY).matches
          : false;

    return systemPrefersDark ? 'dark' : 'light';
}

export function applyThemeClass(theme: Theme, options: ApplyThemeClassOptions = {}) {
    syncThemeClass(theme);

    if (options.persist === false) {
        return;
    }

    saveStoredTheme(theme);
}

export function initializeTheme(options: ThemeInitializerOptions = {}): Theme {
    const theme = resolveTheme({
        storedTheme: getStoredTheme(),
        systemPrefersDark: getSystemTheme(options) === 'dark',
    });

    syncThemeClass(theme);

    return theme;
}
