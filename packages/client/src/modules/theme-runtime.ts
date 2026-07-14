import type {
    AppearancePreferences,
    AppliedTheme,
    PreferredThemes,
    Theme,
    ThemeColorMode,
    ThemeOverrides,
    ThemePackage,
    ThemeRegistry,
    ThemeVariableMap,
} from '~/models/theme.model';
import {
    BUILT_IN_THEME_PACKAGES,
    STUDIO_DARK_THEME_ID,
    STUDIO_LIGHT_THEME_ID,
    STUDIO_PACKAGE_ID,
} from '~/themes/builtin-themes';
import { THEME_VARIABLE_NAMES } from './theme-contract';
import {
    isValidThemeVariableValue,
    MAX_INSTALLED_THEME_PACKAGES,
    MAX_THEME_FILE_BYTES,
    serializeThemePackage,
    THEME_SCHEMA_REFERENCE,
    validateThemeContrast,
    validateThemePackage,
} from './theme-package';

export const APPEARANCE_STORAGE_KEY = 'ocean-brain.appearance.v1';
export const THEME_PACKAGES_STORAGE_KEY = 'ocean-brain.theme-packages.v1';

export const DEFAULT_PREFERRED_THEMES: PreferredThemes = {
    light: STUDIO_LIGHT_THEME_ID,
    dark: STUDIO_DARK_THEME_ID,
};

interface StoredThemePackages {
    packages: ThemePackage[];
    version: 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTheme(value: unknown): value is Theme {
    return value === 'light' || value === 'dark';
}

function isColorMode(value: unknown): value is ThemeColorMode {
    return value === 'system' || isTheme(value);
}

function getStorage(storage?: Storage | null) {
    if (storage !== undefined) return storage;
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function readStorageItem(key: string, storage?: Storage | null) {
    try {
        return getStorage(storage)?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

function writeStorageItem(key: string, value: string, storage?: Storage | null) {
    try {
        getStorage(storage)?.setItem(key, value);
    } catch {
        return;
    }
}

export function getThemeFullId(packageId: string, themeId: string) {
    return `${packageId}/${themeId}`;
}

export function createThemeRegistry(installedPackages: ThemePackage[] = []): ThemeRegistry {
    const packageMap = new Map(BUILT_IN_THEME_PACKAGES.map((themePackage) => [themePackage.id, themePackage]));
    for (const themePackage of installedPackages) {
        if (!packageMap.has(themePackage.id)) packageMap.set(themePackage.id, themePackage);
    }

    const packages = [...packageMap.values()];
    return {
        packages,
        themes: packages.flatMap((themePackage) =>
            themePackage.themes.map((theme) => ({
                ...theme,
                fullId: getThemeFullId(themePackage.id, theme.id),
                packageId: themePackage.id,
                packageName: themePackage.name,
            })),
        ),
    };
}

export function getThemePackagePreferences(registry: ThemeRegistry, packageId: string): PreferredThemes | null {
    const themes = registry.themes.filter((theme) => theme.packageId === packageId);
    const light = themes.find((theme) => theme.appearance === 'light');
    const dark = themes.find((theme) => theme.appearance === 'dark');
    if (!light || !dark) return null;
    return { light: light.fullId, dark: dark.fullId };
}

export function normalizePreferredThemes(registry: ThemeRegistry, preferredThemes: PreferredThemes): PreferredThemes {
    const light = getRegisteredTheme(registry, preferredThemes.light);
    const dark = getRegisteredTheme(registry, preferredThemes.dark);
    if (light?.appearance === 'light' && dark?.appearance === 'dark' && light.packageId === dark.packageId) {
        return getThemePackagePreferences(registry, light.packageId) ?? { ...DEFAULT_PREFERRED_THEMES };
    }

    const candidates = [light?.appearance === 'light' ? light : null, dark?.appearance === 'dark' ? dark : null].filter(
        (theme) => theme !== null,
    );
    const candidate = candidates.find((theme) => theme?.packageId !== STUDIO_PACKAGE_ID) ?? candidates[0];
    return candidate
        ? (getThemePackagePreferences(registry, candidate.packageId) ?? { ...DEFAULT_PREFERRED_THEMES })
        : { ...DEFAULT_PREFERRED_THEMES };
}

export function getRegisteredTheme(registry: ThemeRegistry, fullId: string) {
    return registry.themes.find((theme) => theme.fullId === fullId) ?? null;
}

function getThemePackage(registry: ThemeRegistry, packageId: string) {
    return registry.packages.find((themePackage) => themePackage.id === packageId) ?? null;
}

export function isBuiltInThemePackage(packageId: string) {
    return BUILT_IN_THEME_PACKAGES.some((themePackage) => themePackage.id === packageId);
}

export function resolveAppliedTheme(
    registry: ThemeRegistry,
    requestedThemeId: string,
    appearance: Theme,
    overrides: ThemeVariableMap = {},
): AppliedTheme {
    const requested = getRegisteredTheme(registry, requestedThemeId);
    const fallbackId = appearance === 'dark' ? STUDIO_DARK_THEME_ID : STUDIO_LIGHT_THEME_ID;
    const selected = requested?.appearance === appearance ? requested : getRegisteredTheme(registry, fallbackId);
    if (!selected) throw new Error(`Built-in theme "${fallbackId}" is unavailable.`);
    const appliedOverrides = selected === requested ? overrides : {};
    const variables = { ...(selected.variables ?? {}), ...appliedOverrides };
    const hasContrastError = validateThemeContrast(selected.appearance, variables).some(
        (issue) => issue.severity === 'error',
    );

    return {
        ...selected,
        texture: selected.texture ?? 'none',
        variables: hasContrastError ? { ...(selected.variables ?? {}) } : variables,
    };
}

export function applyThemeToDom(appliedTheme: AppliedTheme, root?: HTMLElement | null) {
    const themeRoot = root ?? (typeof document === 'undefined' ? null : document.documentElement);
    if (!themeRoot) return;

    themeRoot.classList.remove('light', 'dark');
    themeRoot.classList.add(appliedTheme.appearance);
    themeRoot.dataset.themeId = appliedTheme.fullId;
    themeRoot.dataset.themeTexture = appliedTheme.texture;

    for (const variableName of THEME_VARIABLE_NAMES) {
        themeRoot.style.removeProperty(variableName);
    }
    for (const [variableName, value] of Object.entries(appliedTheme.variables)) {
        if (isValidThemeVariableValue(variableName, value)) {
            themeRoot.style.setProperty(variableName, value);
        }
    }
}

function readOverrides(value: unknown) {
    const overrides: ThemeOverrides = {};
    if (!isRecord(value)) return overrides;

    for (const [themeId, variablesValue] of Object.entries(value)) {
        if (!isRecord(variablesValue)) continue;
        const variables: ThemeVariableMap = {};
        for (const [name, variableValue] of Object.entries(variablesValue)) {
            if (isValidThemeVariableValue(name, variableValue)) variables[name] = variableValue;
        }
        if (Object.keys(variables).length > 0) overrides[themeId] = variables;
    }
    return overrides;
}

export function loadAppearancePreferences(legacyTheme: Theme | null, storage?: Storage | null): AppearancePreferences {
    const fallback: AppearancePreferences = {
        version: 1,
        colorMode: legacyTheme ?? 'system',
        preferredThemes: { ...DEFAULT_PREFERRED_THEMES },
        overrides: {},
    };
    const serialized = readStorageItem(APPEARANCE_STORAGE_KEY, storage);
    if (!serialized) return fallback;

    try {
        const parsed: unknown = JSON.parse(serialized);
        if (!isRecord(parsed) || parsed.version !== 1 || !isColorMode(parsed.colorMode)) return fallback;
        const preferred = isRecord(parsed.preferredThemes) ? parsed.preferredThemes : {};
        return {
            version: 1,
            colorMode: parsed.colorMode,
            preferredThemes: {
                light: typeof preferred.light === 'string' ? preferred.light : STUDIO_LIGHT_THEME_ID,
                dark: typeof preferred.dark === 'string' ? preferred.dark : STUDIO_DARK_THEME_ID,
            },
            overrides: readOverrides(parsed.overrides),
        };
    } catch {
        return fallback;
    }
}

export function saveAppearancePreferences(preferences: AppearancePreferences, storage?: Storage | null) {
    writeStorageItem(APPEARANCE_STORAGE_KEY, JSON.stringify(preferences), storage);
}

export function hasStoredAppearancePreferences(storage?: Storage | null) {
    return readStorageItem(APPEARANCE_STORAGE_KEY, storage) !== null;
}

export function loadInstalledThemePackages(storage?: Storage | null) {
    const serialized = readStorageItem(THEME_PACKAGES_STORAGE_KEY, storage);
    if (!serialized) return [];

    try {
        const parsed: unknown = JSON.parse(serialized);
        if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.packages)) return [];
        const packages: ThemePackage[] = [];
        for (const candidate of parsed.packages.slice(0, MAX_INSTALLED_THEME_PACKAGES)) {
            const result = validateThemePackage(candidate);
            if (result.ok && !isBuiltInThemePackage(result.value.id)) packages.push(result.value);
        }
        return packages;
    } catch {
        return [];
    }
}

export function saveInstalledThemePackages(packages: ThemePackage[], storage?: Storage | null) {
    const payload: StoredThemePackages = {
        version: 1,
        packages: packages.slice(0, MAX_INSTALLED_THEME_PACKAGES),
    };
    writeStorageItem(THEME_PACKAGES_STORAGE_KEY, JSON.stringify(payload), storage);
}

export function upsertInstalledThemePackage(installed: ThemePackage[], themePackage: ThemePackage) {
    if (isBuiltInThemePackage(themePackage.id)) return installed;
    const withoutCurrent = installed.filter((candidate) => candidate.id !== themePackage.id);
    return [themePackage, ...withoutCurrent].slice(0, MAX_INSTALLED_THEME_PACKAGES);
}

export function removeInstalledThemePackage(installed: ThemePackage[], packageId: string) {
    return installed.filter((themePackage) => themePackage.id !== packageId);
}

function slugify(value: string) {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return slug || 'theme';
}

function fingerprint(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export function createPortableThemePackage(registry: ThemeRegistry, activeThemeId: string, overrides: ThemeOverrides) {
    const activeTheme = getRegisteredTheme(registry, activeThemeId);
    if (!activeTheme) return null;
    const sourcePackage = getThemePackage(registry, activeTheme.packageId);
    if (!sourcePackage) return null;

    const themes = sourcePackage.themes.map((theme) => ({
        ...theme,
        variables: {
            ...(theme.variables ?? {}),
            ...(overrides[getThemeFullId(sourcePackage.id, theme.id)] ?? {}),
        },
    }));
    const hasOverrides = sourcePackage.themes.some(
        (theme) => Object.keys(overrides[getThemeFullId(sourcePackage.id, theme.id)] ?? {}).length > 0,
    );
    const shouldFork = isBuiltInThemePackage(sourcePackage.id) || hasOverrides;
    const sourceSlug = slugify(sourcePackage.id).slice(0, 56).replace(/-+$/, '') || 'theme';
    const exportFingerprint = fingerprint(`${sourcePackage.id}@${sourcePackage.version}:${JSON.stringify(themes)}`);
    const portable = {
        $schema: THEME_SCHEMA_REFERENCE,
        schemaVersion: 1,
        id: shouldFork ? `local.${sourceSlug}-custom-${exportFingerprint}` : sourcePackage.id,
        name: shouldFork ? `${sourcePackage.name.slice(0, 73)} Custom` : sourcePackage.name,
        version: shouldFork ? '1.0.0' : sourcePackage.version,
        themes,
        ...(shouldFork || !sourcePackage.author ? {} : { author: sourcePackage.author }),
        ...(sourcePackage.description ? { description: sourcePackage.description } : {}),
    } satisfies ThemePackage;
    const result = validateThemePackage(portable);
    if (!result.ok) return null;
    return new TextEncoder().encode(serializeThemePackage(result.value)).byteLength <= MAX_THEME_FILE_BYTES
        ? result.value
        : null;
}

export function createThemeDownload(themePackage: ThemePackage) {
    const filename = `${slugify(themePackage.name)}.obtheme.json`;
    return {
        blob: new Blob([serializeThemePackage(themePackage)], { type: 'application/json;charset=utf-8' }),
        filename,
    };
}
