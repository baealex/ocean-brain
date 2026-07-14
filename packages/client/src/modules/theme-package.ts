import type {
    Theme,
    ThemePackage,
    ThemeValidationIssue,
    ThemeValidationResult,
    ThemeVariableMap,
    ThemeVariant,
} from '~/models/theme.model';
import { isThemeTexture, isThemeVariableName, THEME_VARIABLE_KINDS } from './theme-contract';

const THEME_SCHEMA_VERSION = 1;
export const THEME_SCHEMA_REFERENCE =
    'https://raw.githubusercontent.com/baealex/ocean-brain/main/packages/client/public/schemas/ocean-brain-theme-v1.schema.json';
export const MAX_THEME_FILE_BYTES = 64 * 1024;
export const MAX_INSTALLED_THEME_PACKAGES = 12;

const PACKAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;
const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const COLOR_PATTERN = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const LENGTH_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?px$/;
const FONT_PATTERN = /^[\p{L}\p{N}\s,'"-]+$/u;
const SHADOW_LAYER_PATTERN =
    /^(?:inset\s+)?(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8}))$/i;
const PACKAGE_KEYS = new Set(['$schema', 'author', 'description', 'id', 'name', 'schemaVersion', 'themes', 'version']);
const THEME_KEYS = new Set(['appearance', 'description', 'id', 'label', 'texture', 'variables']);
const BORDER_STYLES = new Set(['dashed', 'dotted', 'solid']);
const FORBIDDEN_VALUE_PATTERN = /(?:url\s*\(|@import|expression\s*\(|javascript:|[;{}])/i;

const ACCESSIBILITY_DEFAULTS: Record<Theme, ThemeVariableMap> = {
    light: {
        '--surface': '#f7f8fa',
        '--fg-default': '#202631',
        '--fg-secondary': '#626d7c',
        '--fg-tertiary': '#8993a2',
        '--fg-placeholder': '#98a2b0',
        '--cta': '#23272d',
        '--cta-hover': '#171a1f',
        '--fg-on-accent': '#f6f8fb',
        '--fg-on-filled': '#f6f8fb',
        '--accent-secondary': '#5d6672',
        '--accent-secondary-hover': '#4f5762',
        '--accent-danger': '#b94a4a',
        '--accent-danger-hover': '#a53e3e',
        '--page-bg': '#f2f5f8',
        '--border-focus': '#757f8d',
    },
    dark: {
        '--surface': '#16191e',
        '--fg-default': '#e6ebf2',
        '--fg-secondary': '#a9b3c2',
        '--fg-tertiary': '#7f8998',
        '--fg-placeholder': '#717b88',
        '--cta': '#edf1f5',
        '--cta-hover': '#f8fafc',
        '--fg-on-accent': '#12161c',
        '--fg-on-filled': '#12161c',
        '--accent-secondary': '#b8c0ca',
        '--accent-secondary-hover': '#c9d0d8',
        '--accent-danger': '#d36f6f',
        '--accent-danger-hover': '#e08383',
        '--page-bg': '#101318',
        '--border-focus': '#b4c0cf',
    },
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function issue(
    issues: ThemeValidationIssue[],
    severity: ThemeValidationIssue['severity'],
    code: string,
    path: string,
    message: string,
) {
    issues.push({ severity, code, path, message });
}

function validateKnownKeys(
    value: Record<string, unknown>,
    allowed: Set<string>,
    path: string,
    issues: ThemeValidationIssue[],
) {
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
            issue(issues, 'error', 'unknown-field', `${path}.${key}`, `Unknown field "${key}".`);
        }
    }
}

function requiredString(
    value: Record<string, unknown>,
    key: string,
    path: string,
    maximum: number,
    issues: ThemeValidationIssue[],
) {
    const candidate = value[key];
    if (typeof candidate !== 'string' || candidate.trim().length === 0 || candidate.length > maximum) {
        issue(
            issues,
            'error',
            'invalid-string',
            `${path}.${key}`,
            `Expected a non-empty string no longer than ${maximum} characters.`,
        );
        return null;
    }
    return candidate.trim();
}

function optionalString(
    value: Record<string, unknown>,
    key: string,
    path: string,
    maximum: number,
    issues: ThemeValidationIssue[],
) {
    if (value[key] === undefined) return undefined;
    return requiredString(value, key, path, maximum, issues) ?? undefined;
}

function isRadius(value: string) {
    const axes = value.split('/').map((part) => part.trim());
    if (axes.length > 2) return false;

    return axes.every((axis) => {
        const radii = axis.split(/\s+/);
        return (
            radii.length >= 1 &&
            radii.length <= 4 &&
            radii.every((radius) => {
                if (!LENGTH_PATTERN.test(radius) || radius.startsWith('-')) return false;
                const number = Number.parseFloat(radius);
                return number >= 0 && number <= 999;
            })
        );
    });
}

function isShadow(value: string) {
    if (value === 'none') return true;
    const layers = value.split(',').map((layer) => layer.trim());
    return (
        layers.length >= 1 &&
        layers.length <= 4 &&
        layers.every((layer) => {
            const match = SHADOW_LAYER_PATTERN.exec(layer);
            if (!match) return false;
            const [, offsetX, offsetY, blur, spread] = match.map(Number);
            return Math.abs(offsetX) <= 64 && Math.abs(offsetY) <= 64 && blur <= 128 && Math.abs(spread) <= 64;
        })
    );
}

function isLength(variableName: string, value: string) {
    if (!LENGTH_PATTERN.test(value)) return false;
    const number = Number.parseFloat(value);
    if (variableName.includes('border')) return number >= 0 && number <= 4;
    return number >= -4 && number <= 4;
}

export function isValidThemeVariableValue(variableName: string, value: unknown): value is string {
    if (!isThemeVariableName(variableName) || typeof value !== 'string' || value.length === 0 || value.length > 400) {
        return false;
    }
    if (FORBIDDEN_VALUE_PATTERN.test(value)) return false;

    switch (THEME_VARIABLE_KINDS[variableName]) {
        case 'borderStyle':
            return BORDER_STYLES.has(value);
        case 'color':
            return COLOR_PATTERN.test(value);
        case 'font':
            return value.length <= 120 && FONT_PATTERN.test(value);
        case 'length':
            return isLength(variableName, value);
        case 'radius':
            return isRadius(value);
        case 'shadow':
            return isShadow(value);
    }
}

function validateVariables(value: unknown, path: string, issues: ThemeValidationIssue[]) {
    const variables: ThemeVariableMap = {};
    if (value === undefined) return variables;
    if (!isRecord(value)) {
        issue(issues, 'error', 'invalid-variables', path, 'Expected an object of CSS custom properties.');
        return variables;
    }

    for (const [name, variableValue] of Object.entries(value)) {
        if (!isThemeVariableName(name)) {
            issue(issues, 'error', 'unknown-variable', `${path}.${name}`, `Theme variable "${name}" is not supported.`);
            continue;
        }
        if (!isValidThemeVariableValue(name, variableValue)) {
            issue(issues, 'error', 'invalid-variable-value', `${path}.${name}`, `Invalid value for "${name}".`);
            continue;
        }
        variables[name] = variableValue;
    }
    return variables;
}

function validateTheme(value: unknown, index: number, issues: ThemeValidationIssue[]): ThemeVariant | null {
    const path = `package.themes[${index}]`;
    if (!isRecord(value)) {
        issue(issues, 'error', 'invalid-theme', path, 'Expected a theme object.');
        return null;
    }

    validateKnownKeys(value, THEME_KEYS, path, issues);
    const id = requiredString(value, 'id', path, 64, issues);
    const label = requiredString(value, 'label', path, 80, issues);
    const description = optionalString(value, 'description', path, 240, issues);
    const appearance = value.appearance;
    const texture = value.texture;
    const validatedTexture = isThemeTexture(texture) ? texture : undefined;
    const variables = validateVariables(value.variables, `${path}.variables`, issues);

    if (id && !THEME_ID_PATTERN.test(id)) {
        issue(
            issues,
            'error',
            'invalid-theme-id',
            `${path}.id`,
            'Theme IDs must contain lowercase letters, numbers, and hyphens only.',
        );
    }
    if (appearance !== 'light' && appearance !== 'dark') {
        issue(issues, 'error', 'invalid-appearance', `${path}.appearance`, 'Appearance must be light or dark.');
    }
    if (texture !== undefined && !isThemeTexture(texture)) {
        issue(issues, 'error', 'invalid-texture', `${path}.texture`, 'Texture must be none, paper, grid, or dots.');
    }
    if (!id || !label || !THEME_ID_PATTERN.test(id) || (appearance !== 'light' && appearance !== 'dark')) {
        return null;
    }

    return {
        id,
        label,
        appearance,
        ...(description ? { description } : {}),
        ...(validatedTexture ? { texture: validatedTexture } : {}),
        ...(Object.keys(variables).length > 0 ? { variables } : {}),
    };
}

interface Rgb {
    alpha: number;
    blue: number;
    green: number;
    red: number;
}

function parseColor(value: string): Rgb {
    const compact = value.slice(1);
    const expanded = compact.length <= 4 ? [...compact].map((character) => character.repeat(2)).join('') : compact;
    return {
        red: Number.parseInt(expanded.slice(0, 2), 16),
        green: Number.parseInt(expanded.slice(2, 4), 16),
        blue: Number.parseInt(expanded.slice(4, 6), 16),
        alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    };
}

function composite(foreground: Rgb, background: Rgb): Rgb {
    const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
    return {
        red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
        green:
            (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) /
            alpha,
        blue:
            (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
        alpha,
    };
}

function luminance(color: Rgb) {
    const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return channel(color.red) * 0.2126 + channel(color.green) * 0.7152 + channel(color.blue) * 0.0722;
}

function getContrastRatio(foreground: string, background: string, opacity = 1) {
    const opaqueBackground = composite(parseColor(background), { red: 255, green: 255, blue: 255, alpha: 1 });
    const foregroundColor = parseColor(foreground);
    foregroundColor.alpha *= opacity;
    const opaqueForeground = composite(foregroundColor, opaqueBackground);
    const foregroundLuminance = luminance(opaqueForeground);
    const backgroundLuminance = luminance(opaqueBackground);
    return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
    );
}

function validateContrast(theme: ThemeVariant, index: number, issues: ThemeValidationIssue[]) {
    const variables = {
        ...ACCESSIBILITY_DEFAULTS[theme.appearance],
        ...(theme.variables ?? {}),
    };
    const pairs = [
        ['--fg-default', '--surface', 4.5, 'Default text on surfaces', 'error'],
        ['--fg-secondary', '--surface', 4.5, 'Secondary text on surfaces', 'error'],
        ['--fg-tertiary', '--surface', 2.5, 'Tertiary text on surfaces', 'error'],
        ['--fg-placeholder', '--surface', 2, 'Placeholder text on surfaces', 'error'],
        ['--fg-on-filled', '--cta', 4.5, 'Filled button text', 'error'],
        ['--fg-on-filled', '--cta-hover', 4.5, 'Hovered filled button text', 'error'],
        ['--fg-on-accent', '--accent-secondary', 4.5, 'Signature button text', 'error'],
        ['--fg-on-accent', '--accent-secondary-hover', 4.5, 'Hovered signature button text', 'error'],
        ['--fg-on-filled', '--accent-danger', 4.5, 'Danger button text', 'error'],
        ['--fg-on-filled', '--accent-danger-hover', 4.5, 'Hovered danger button text', 'error'],
    ] as const;

    for (const backgroundName of [
        '--surface',
        '--cta',
        '--cta-hover',
        '--page-bg',
        '--accent-secondary',
        '--accent-secondary-hover',
        '--accent-danger',
        '--accent-danger-hover',
    ] as const) {
        if (parseColor(variables[backgroundName]).alpha < 1) {
            issue(
                issues,
                'error',
                'transparent-content-background',
                `package.themes[${index}].variables.${backgroundName}`,
                `${backgroundName} must be opaque so contrast remains predictable.`,
            );
        }
    }

    for (const [foregroundName, backgroundName, minimum, label, severity] of pairs) {
        const ratio = getContrastRatio(variables[foregroundName], variables[backgroundName]);
        if (ratio < minimum) {
            issue(
                issues,
                severity,
                'insufficient-contrast',
                `package.themes[${index}].variables.${foregroundName}`,
                `${label} has ${ratio.toFixed(2)}:1 contrast; ${minimum.toFixed(1)}:1 is required.`,
            );
        }
    }

    for (const backgroundName of ['--page-bg', '--surface'] as const) {
        const focusRingRatio = getContrastRatio(variables['--border-focus'], variables[backgroundName], 0.9);
        if (focusRingRatio < 3) {
            issue(
                issues,
                'error',
                'invisible-focus-indicator',
                `package.themes[${index}].variables.--border-focus`,
                `Focus rings have ${focusRingRatio.toFixed(2)}:1 contrast on ${backgroundName}; 3.0:1 is required.`,
            );
        }
    }
}

export function validateThemeContrast(appearance: Theme, variables: ThemeVariableMap) {
    const issues: ThemeValidationIssue[] = [];
    validateContrast({ appearance, id: 'theme', label: 'Theme', variables }, 0, issues);
    return issues;
}

export function validateThemePackage(value: unknown): ThemeValidationResult<ThemePackage> {
    const issues: ThemeValidationIssue[] = [];
    if (!isRecord(value)) {
        return {
            ok: false,
            issues: [{ severity: 'error', code: 'invalid-package', path: 'package', message: 'Expected an object.' }],
        };
    }

    validateKnownKeys(value, PACKAGE_KEYS, 'package', issues);
    const id = requiredString(value, 'id', 'package', 96, issues);
    const name = requiredString(value, 'name', 'package', 80, issues);
    const version = requiredString(value, 'version', 'package', 48, issues);
    const author = optionalString(value, 'author', 'package', 80, issues);
    const description = optionalString(value, 'description', 'package', 320, issues);
    const schema = optionalString(value, '$schema', 'package', 320, issues);
    if (value.schemaVersion !== THEME_SCHEMA_VERSION) {
        issue(
            issues,
            'error',
            'unsupported-schema',
            'package.schemaVersion',
            `Only theme schema version ${THEME_SCHEMA_VERSION} is supported.`,
        );
    }
    if (schema && schema !== THEME_SCHEMA_REFERENCE) {
        issue(
            issues,
            'error',
            'invalid-schema-reference',
            'package.$schema',
            `Theme schema must be "${THEME_SCHEMA_REFERENCE}".`,
        );
    }
    if (id && !PACKAGE_ID_PATTERN.test(id)) {
        issue(issues, 'error', 'invalid-package-id', 'package.id', 'Package IDs must use publisher.name format.');
    }
    if (version && !SEMVER_PATTERN.test(version)) {
        issue(issues, 'error', 'invalid-version', 'package.version', 'Package version must use SemVer.');
    }

    const themes: ThemeVariant[] = [];
    if (!Array.isArray(value.themes) || value.themes.length !== 2) {
        issue(
            issues,
            'error',
            'invalid-theme-set',
            'package.themes',
            'A theme set must contain exactly one light theme and one dark theme.',
        );
    } else {
        value.themes.forEach((theme, index) => {
            const validated = validateTheme(theme, index, issues);
            if (validated) themes.push(validated);
        });
    }

    const seenThemeIds = new Set<string>();
    themes.forEach((theme, index) => {
        if (seenThemeIds.has(theme.id)) {
            issue(issues, 'error', 'duplicate-theme-id', `package.themes[${index}].id`, `Duplicate ID "${theme.id}".`);
        }
        seenThemeIds.add(theme.id);
        validateContrast(theme, index, issues);
    });
    if (
        themes.length === 2 &&
        (themes.filter((theme) => theme.appearance === 'light').length !== 1 ||
            themes.filter((theme) => theme.appearance === 'dark').length !== 1)
    ) {
        issue(
            issues,
            'error',
            'invalid-theme-set',
            'package.themes',
            'A theme set must contain exactly one light theme and one dark theme.',
        );
    }

    if (issues.some((item) => item.severity === 'error') || !id || !name || !version) {
        return { ok: false, issues };
    }

    return {
        ok: true,
        value: {
            schemaVersion: 1,
            id,
            name,
            version,
            themes,
            ...(schema ? { $schema: schema } : {}),
            ...(author ? { author } : {}),
            ...(description ? { description } : {}),
        },
        issues,
    };
}

export function parseThemePackage(text: string): ThemeValidationResult<ThemePackage> {
    if (new TextEncoder().encode(text).byteLength > MAX_THEME_FILE_BYTES) {
        return {
            ok: false,
            issues: [
                {
                    severity: 'error',
                    code: 'file-too-large',
                    path: 'package',
                    message: `Theme files cannot exceed ${MAX_THEME_FILE_BYTES / 1024} KB.`,
                },
            ],
        };
    }

    try {
        return validateThemePackage(JSON.parse(text));
    } catch {
        return {
            ok: false,
            issues: [{ severity: 'error', code: 'invalid-json', path: 'package', message: 'Invalid JSON.' }],
        };
    }
}

export function serializeThemePackage(themePackage: ThemePackage) {
    return `${JSON.stringify(themePackage, null, 2)}\n`;
}
