import { create } from 'zustand';

import type {
    AppearancePreferences,
    AppliedTheme,
    PreferredThemes,
    Theme,
    ThemeColorMode,
    ThemeOverrides,
    ThemePackage,
    ThemeRegistry,
} from '~/models/theme.model';
import { isValidThemeVariableValue, validateThemeContrast } from '~/modules/theme-package';
import {
    applyThemeToDom,
    createThemeRegistry,
    DEFAULT_PREFERRED_THEMES,
    getRegisteredTheme,
    getThemePackagePreferences,
    hasStoredAppearancePreferences,
    loadAppearancePreferences,
    loadInstalledThemePackages,
    normalizePreferredThemes,
    removeInstalledThemePackage,
    resolveAppliedTheme,
    saveAppearancePreferences,
    saveInstalledThemePackages,
    upsertInstalledThemePackage,
} from '~/modules/theme-runtime';
import { getStoredTheme, getSystemTheme, saveStoredTheme } from './theme-dom';

export type { Theme } from '~/models/theme.model';

export interface ThemeState {
    activeTheme: AppliedTheme;
    cancelThemePreview: () => void;
    colorMode: ThemeColorMode;
    explicitTheme: Theme | null;
    installThemePackage: (themePackage: ThemePackage) => void;
    installedThemePackages: ThemePackage[];
    overrides: ThemeOverrides;
    preferredThemes: PreferredThemes;
    previewTheme: (themeId: string) => void;
    previewThemeId: string | null;
    registry: ThemeRegistry;
    removeThemePackage: (packageId: string) => void;
    resetAppearance: () => void;
    resetThemeOverrides: (themeId: string) => void;
    setColorMode: (colorMode: ThemeColorMode) => void;
    setPreferredThemePackage: (packageId: string) => void;
    setSystemTheme: (theme: Theme) => void;
    setTheme: (theme: Theme) => void;
    setThemeOverride: (themeId: string, variableName: string, value: string | null) => boolean;
    systemTheme: Theme;
    theme: Theme;
    toggleTheme: () => void;
    usePreviewedTheme: () => void;
}

interface ThemeSnapshot {
    activeTheme: AppliedTheme;
    explicitTheme: Theme | null;
    previewThemeId: string | null;
    theme: Theme;
}

type ThemeData = Pick<
    ThemeState,
    | 'colorMode'
    | 'installedThemePackages'
    | 'overrides'
    | 'preferredThemes'
    | 'previewThemeId'
    | 'registry'
    | 'systemTheme'
>;

type ThemePatch = Partial<ThemeData>;

function resolveSnapshot(data: ThemeData): ThemeSnapshot {
    const appearance = data.colorMode === 'system' ? data.systemTheme : data.colorMode;
    const requestedPreview = data.previewThemeId ? getRegisteredTheme(data.registry, data.previewThemeId) : null;
    const preview = requestedPreview?.appearance === appearance ? requestedPreview : null;
    const requestedThemeId = preview?.fullId ?? data.preferredThemes[appearance];
    const activeTheme = resolveAppliedTheme(
        data.registry,
        requestedThemeId,
        appearance,
        data.overrides[requestedThemeId] ?? {},
    );

    return {
        activeTheme,
        explicitTheme: data.colorMode === 'system' ? null : data.colorMode,
        previewThemeId: preview?.fullId ?? null,
        theme: appearance,
    };
}

function transition(state: ThemeState, patch: ThemePatch): ThemePatch & ThemeSnapshot {
    const data: ThemeData = {
        colorMode: patch.colorMode ?? state.colorMode,
        installedThemePackages: patch.installedThemePackages ?? state.installedThemePackages,
        overrides: patch.overrides ?? state.overrides,
        preferredThemes: patch.preferredThemes ?? state.preferredThemes,
        previewThemeId: patch.previewThemeId === undefined ? state.previewThemeId : patch.previewThemeId,
        registry: patch.registry ?? state.registry,
        systemTheme: patch.systemTheme ?? state.systemTheme,
    };

    return { ...patch, ...resolveSnapshot(data) };
}

const initialPreferences = loadAppearancePreferences(getStoredTheme());
const initialInstalledThemePackages = loadInstalledThemePackages();
const initialRegistry = createThemeRegistry(initialInstalledThemePackages);
const initialData: ThemeData = {
    colorMode: initialPreferences.colorMode,
    installedThemePackages: initialInstalledThemePackages,
    overrides: initialPreferences.overrides,
    preferredThemes: normalizePreferredThemes(initialRegistry, initialPreferences.preferredThemes),
    previewThemeId: null,
    registry: initialRegistry,
    systemTheme: 'light',
};

export const useTheme = create<ThemeState>((set, get) => ({
    ...initialData,
    ...resolveSnapshot(initialData),
    setTheme: (theme) => set((state) => transition(state, { colorMode: theme, previewThemeId: null })),
    setSystemTheme: (systemTheme) => set((state) => transition(state, { systemTheme })),
    toggleTheme: () =>
        set((state) =>
            transition(state, {
                colorMode: state.theme === 'light' ? 'dark' : 'light',
                previewThemeId: null,
            }),
        ),
    setColorMode: (colorMode) => set((state) => transition(state, { colorMode, previewThemeId: null })),
    setPreferredThemePackage: (packageId) =>
        set((state) => {
            const preferredThemes = getThemePackagePreferences(state.registry, packageId);
            if (!preferredThemes) return state;
            return transition(state, { preferredThemes, previewThemeId: null });
        }),
    previewTheme: (themeId) => set((state) => transition(state, { previewThemeId: themeId })),
    cancelThemePreview: () => set((state) => transition(state, { previewThemeId: null })),
    usePreviewedTheme: () =>
        set((state) => {
            const preview = state.previewThemeId ? getRegisteredTheme(state.registry, state.previewThemeId) : null;
            if (!preview) return state;

            const preferredThemes = getThemePackagePreferences(state.registry, preview.packageId);
            if (!preferredThemes) return transition(state, { previewThemeId: null });
            return transition(state, { preferredThemes, previewThemeId: null });
        }),
    installThemePackage: (themePackage) =>
        set((state) => {
            const installedThemePackages = upsertInstalledThemePackage(state.installedThemePackages, themePackage);
            const registry = createThemeRegistry(installedThemePackages);
            return transition(state, {
                installedThemePackages,
                preferredThemes: normalizePreferredThemes(registry, state.preferredThemes),
                registry,
            });
        }),
    removeThemePackage: (packageId) =>
        set((state) => {
            const installedThemePackages = removeInstalledThemePackage(state.installedThemePackages, packageId);
            const removesSelectedPackage = Object.values(state.preferredThemes).some((themeId) =>
                themeId.startsWith(`${packageId}/`),
            );
            const preferredThemes = removesSelectedPackage ? { ...DEFAULT_PREFERRED_THEMES } : state.preferredThemes;
            const overrides = Object.fromEntries(
                Object.entries(state.overrides).filter(([themeId]) => !themeId.startsWith(`${packageId}/`)),
            );

            return transition(state, {
                installedThemePackages,
                overrides,
                preferredThemes,
                previewThemeId: null,
                registry: createThemeRegistry(installedThemePackages),
            });
        }),
    setThemeOverride: (themeId, variableName, value) => {
        if (value !== null && !isValidThemeVariableValue(variableName, value)) return false;
        const current = get();
        const theme = getRegisteredTheme(current.registry, themeId);
        if (!theme) return false;

        const variables = { ...(current.overrides[themeId] ?? {}) };
        if (value === null) delete variables[variableName];
        else variables[variableName] = value;
        const contrastIssues = validateThemeContrast(theme.appearance, {
            ...(theme.variables ?? {}),
            ...variables,
        });
        if (contrastIssues.some((issue) => issue.severity === 'error')) return false;

        set((state) => {
            const overrides = { ...state.overrides };
            if (Object.keys(variables).length === 0) delete overrides[themeId];
            else overrides[themeId] = variables;
            return transition(state, { overrides });
        });
        return true;
    },
    resetThemeOverrides: (themeId) =>
        set((state) => {
            if (!state.overrides[themeId]) return state;
            const overrides = { ...state.overrides };
            delete overrides[themeId];
            return transition(state, { overrides });
        }),
    resetAppearance: () =>
        set((state) =>
            transition(state, {
                colorMode: 'system',
                overrides: {},
                preferredThemes: { ...DEFAULT_PREFERRED_THEMES },
                previewThemeId: null,
            }),
        ),
}));

function getAppearancePreferences(state: ThemeState): AppearancePreferences {
    return {
        version: 1,
        colorMode: state.colorMode,
        preferredThemes: state.preferredThemes,
        overrides: state.overrides,
    };
}

function persistThemeState(state: ThemeState, previousState: ThemeState) {
    if (
        state.colorMode !== previousState.colorMode ||
        state.preferredThemes !== previousState.preferredThemes ||
        state.overrides !== previousState.overrides
    ) {
        saveAppearancePreferences(getAppearancePreferences(state));
        saveStoredTheme(state.colorMode === 'system' ? null : state.colorMode);
    }
    if (state.installedThemePackages !== previousState.installedThemePackages) {
        saveInstalledThemePackages(state.installedThemePackages);
    }
}

useTheme.subscribe((state, previousState) => {
    if (state.activeTheme !== previousState.activeTheme) applyThemeToDom(state.activeTheme);
    persistThemeState(state, previousState);
});

export function initializeThemeSystem() {
    useTheme.getState().setSystemTheme(getSystemTheme());
    const state = useTheme.getState();
    if (!hasStoredAppearancePreferences()) saveAppearancePreferences(getAppearancePreferences(state));
    return state.theme;
}
