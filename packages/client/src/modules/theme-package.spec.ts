import { describe, expect, it } from 'vitest';
import { BUILT_IN_THEME_PACKAGES } from '~/themes/builtin-themes';
import {
    MAX_THEME_FILE_BYTES,
    parseThemePackage,
    serializeThemePackage,
    THEME_SCHEMA_REFERENCE,
    validateThemePackage,
} from './theme-package';

const validPackage = {
    $schema: THEME_SCHEMA_REFERENCE,
    schemaVersion: 1,
    id: 'example.paper',
    name: 'Paper',
    version: '1.2.0',
    themes: [
        {
            id: 'light',
            label: 'Paper Light',
            appearance: 'light',
            texture: 'paper',
            variables: {
                '--page-bg': '#fdf8f3',
                '--surface': '#fffcf7',
                '--fg-default': '#332f2a',
                '--cta': '#332f2a',
                '--fg-on-filled': '#fffaf3',
                '--ob-radius-surface': '24px 8px 22px 7px / 8px 22px 7px 24px',
                '--ob-shadow-surface': '4px 4px 0px 0px #00000022',
            },
        },
        {
            id: 'dark',
            label: 'Paper Dark',
            appearance: 'dark',
        },
    ],
};

describe('theme-package', () => {
    it('accepts a declarative package with safe visual variables', () => {
        const result = validateThemePackage(validPackage);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.id).toBe('example.paper');
        expect(result.value.themes[0].texture).toBe('paper');
        expect(result.value.themes[0].variables?.['--ob-radius-surface']).toContain('/');
    });

    it.each([
        ['unknown variable', { '--not-an-ocean-token': '#ffffff' }, 'unknown-variable'],
        ['remote URL', { '--ob-font-ui': 'url(https://tracker.example/font.woff2)' }, 'invalid-variable-value'],
        ['CSS declaration escape', { '--ob-shadow-surface': 'none; display: none' }, 'invalid-variable-value'],
        ['script URL', { '--ob-font-ui': 'javascript:alert(1)' }, 'invalid-variable-value'],
    ])('rejects %s input', (_label, variables, expectedCode) => {
        const result = validateThemePackage({
            ...validPackage,
            themes: [{ ...validPackage.themes[0], variables }, validPackage.themes[1]],
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: expectedCode })]));
    });

    it('rejects unreadable critical color pairs', () => {
        const result = validateThemePackage({
            ...validPackage,
            themes: [
                {
                    ...validPackage.themes[0],
                    variables: {
                        '--surface': '#ffffff',
                        '--fg-default': '#ffffff',
                    },
                },
                validPackage.themes[1],
            ],
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'insufficient-contrast', severity: 'error' })]),
        );
    });

    it('rejects transparent content backgrounds', () => {
        const result = validateThemePackage({
            ...validPackage,
            themes: [
                {
                    ...validPackage.themes[0],
                    variables: { ...validPackage.themes[0].variables, '--surface': '#ffffff80' },
                },
                validPackage.themes[1],
            ],
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'transparent-content-background' })]),
        );
    });

    it.each([
        ['invalid hexadecimal colors', '4px 4px 0px 0px #12345'],
        ['oversized offsets', '65px 0px 0px 0px #00000022'],
        ['oversized blur', '0px 0px 129px 0px #00000022'],
    ])('rejects shadows with %s', (_label, shadow) => {
        const result = validateThemePackage({
            ...validPackage,
            themes: [
                {
                    ...validPackage.themes[0],
                    variables: { ...validPackage.themes[0].variables, '--ob-shadow-surface': shadow },
                },
                validPackage.themes[1],
            ],
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'invalid-variable-value' })]),
        );
    });

    it('rejects unreadable signature button colors', () => {
        const result = validateThemePackage({
            ...validPackage,
            themes: [
                {
                    ...validPackage.themes[0],
                    variables: {
                        ...validPackage.themes[0].variables,
                        '--accent-secondary': '#ffffff',
                        '--fg-on-accent': '#ffffff',
                    },
                },
                validPackage.themes[1],
            ],
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'insufficient-contrast', severity: 'error' })]),
        );
    });

    it('rejects themes that hide both focus indicators', () => {
        const result = validateThemePackage({
            ...validPackage,
            themes: [
                {
                    ...validPackage.themes[0],
                    variables: {
                        ...validPackage.themes[0].variables,
                        '--accent-soft-primary': '#ffffff00',
                        '--border-focus': '#ffffff00',
                    },
                },
                validPackage.themes[1],
            ],
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'invisible-focus-indicator' })]),
        );
    });

    it('rejects a focus ring that disappears on surfaces', () => {
        const result = validateThemePackage({
            ...validPackage,
            themes: [
                {
                    ...validPackage.themes[0],
                    variables: {
                        ...validPackage.themes[0].variables,
                        '--surface': '#111111',
                        '--fg-default': '#ffffff',
                        '--fg-secondary': '#ffffff',
                        '--fg-tertiary': '#ffffff',
                        '--fg-placeholder': '#ffffff',
                        '--border-focus': '#111111',
                    },
                },
                validPackage.themes[1],
            ],
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'invisible-focus-indicator' })]),
        );
    });

    it('rejects unsupported schema versions', () => {
        const result = validateThemePackage({
            ...validPackage,
            schemaVersion: 2,
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'unsupported-schema' })]),
        );
    });

    it.each([
        ['a missing dark theme', [validPackage.themes[0]]],
        ['duplicate light themes', [validPackage.themes[0], { ...validPackage.themes[0], id: 'alternate-light' }]],
    ])('rejects %s', (_label, themes) => {
        const result = validateThemePackage({ ...validPackage, themes });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'invalid-theme-set' })]));
    });

    it('rejects remote schema references', () => {
        const result = validateThemePackage({
            ...validPackage,
            $schema: 'https://tracker.example/theme.schema.json',
        });

        expect(result.ok).toBe(false);
        expect(result.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'invalid-schema-reference' })]),
        );
    });

    it('reports malformed and oversized JSON files', () => {
        const malformed = parseThemePackage('{');
        const oversized = parseThemePackage(' '.repeat(MAX_THEME_FILE_BYTES + 1));

        expect(malformed.ok).toBe(false);
        expect(malformed.issues[0].code).toBe('invalid-json');
        expect(oversized.ok).toBe(false);
        expect(oversized.issues[0].code).toBe('file-too-large');
    });

    it('serializes a portable JSON document with a trailing newline', () => {
        const result = validateThemePackage(validPackage);
        if (!result.ok) throw new Error('Fixture must be valid.');

        const serialized = serializeThemePackage(result.value);

        expect(serialized.endsWith('\n')).toBe(true);
        expect(JSON.parse(serialized)).toEqual(result.value);
    });

    it('keeps every built-in theme package within the public contract', () => {
        const results = BUILT_IN_THEME_PACKAGES.map(validateThemePackage);

        expect(results).toEqual(
            BUILT_IN_THEME_PACKAGES.map((themePackage) =>
                expect.objectContaining({
                    ok: true,
                    value: expect.objectContaining({ id: themePackage.id }),
                }),
            ),
        );
    });
});
