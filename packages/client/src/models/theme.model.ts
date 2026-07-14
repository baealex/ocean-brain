export type Theme = 'light' | 'dark';
export type ThemeColorMode = Theme | 'system';
export type ThemeTexture = 'dots' | 'grid' | 'none' | 'paper';
export type ThemeVariableMap = Record<string, string>;

export interface ThemeVariant {
    appearance: Theme;
    description?: string;
    id: string;
    label: string;
    texture?: ThemeTexture;
    variables?: ThemeVariableMap;
}

export interface ThemePackage {
    $schema?: string;
    author?: string;
    description?: string;
    id: string;
    name: string;
    schemaVersion: 1;
    themes: ThemeVariant[];
    version: string;
}

export interface RegisteredTheme extends ThemeVariant {
    fullId: string;
    packageId: string;
    packageName: string;
}

export interface AppliedTheme extends RegisteredTheme {
    texture: ThemeTexture;
    variables: ThemeVariableMap;
}

export interface ThemeRegistry {
    packages: ThemePackage[];
    themes: RegisteredTheme[];
}

export interface PreferredThemes {
    dark: string;
    light: string;
}

export type ThemeOverrides = Record<string, ThemeVariableMap>;

export interface AppearancePreferences {
    colorMode: ThemeColorMode;
    overrides: ThemeOverrides;
    preferredThemes: PreferredThemes;
    version: 1;
}

export interface ThemeValidationIssue {
    code: string;
    message: string;
    path: string;
    severity: 'error' | 'warning';
}

export type ThemeValidationResult<T> =
    | { issues: ThemeValidationIssue[]; ok: true; value: T }
    | { issues: ThemeValidationIssue[]; ok: false };
