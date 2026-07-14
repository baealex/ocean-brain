import type { ThemeTexture } from '~/models/theme.model';

export type ThemeVariableKind = 'borderStyle' | 'color' | 'font' | 'length' | 'radius' | 'shadow';

const COLOR_VARIABLES = [
    '--page-bg',
    '--surface',
    '--muted',
    '--subtle',
    '--elevated',
    '--emphasis',
    '--hover',
    '--hover-subtle',
    '--active',
    '--ghost',
    '--fg',
    '--fg-default',
    '--fg-muted',
    '--fg-secondary',
    '--fg-tertiary',
    '--fg-disabled',
    '--fg-placeholder',
    '--fg-error',
    '--fg-on-accent',
    '--fg-on-filled',
    '--fg-weekend',
    '--border',
    '--border-secondary',
    '--border-subtle',
    '--border-focus',
    '--border-error',
    '--accent-primary',
    '--accent-primary-hover',
    '--accent-secondary',
    '--accent-secondary-hover',
    '--accent-danger',
    '--accent-danger-hover',
    '--accent-success',
    '--accent-success-hover',
    '--accent-soft-primary',
    '--accent-soft-primary-hover',
    '--accent-soft-danger',
    '--accent-soft-danger-hover',
    '--accent-soft-success',
    '--accent-soft-success-hover',
    '--cta',
    '--cta-hover',
    '--overlay',
    '--highlight',
    '--highlight-fg',
    '--divider',
    '--palette-yellow',
    '--palette-green',
    '--palette-pink',
    '--palette-orange',
    '--palette-blue',
    '--palette-purple',
    '--palette-teal',
    '--palette-lavender',
    '--priority-high',
    '--priority-medium',
    '--priority-low',
    '--ob-graph-background',
    '--ob-graph-node-hub',
    '--ob-graph-node-selected',
    '--ob-graph-node-connected',
    '--ob-graph-node-default-1',
    '--ob-graph-node-default-2',
    '--ob-graph-node-default-3',
    '--ob-graph-node-default-4',
    '--ob-graph-node-dimmed-1',
    '--ob-graph-node-dimmed-2',
    '--ob-graph-node-dimmed-3',
    '--ob-graph-node-dimmed-4',
    '--ob-graph-node-hub-dimmed',
    '--ob-graph-node-stroke',
    '--ob-graph-node-selected-stroke',
    '--ob-graph-label-background',
    '--ob-graph-label-text',
    '--ob-graph-link-idle',
    '--ob-graph-link-connected',
    '--ob-graph-link-dimmed',
    '--ob-graph-legend-hub',
] as const;

const RADIUS_VARIABLES = [
    '--ob-radius-control-sm',
    '--ob-radius-control-md',
    '--ob-radius-control-lg',
    '--ob-radius-item',
    '--ob-radius-surface',
    '--ob-radius-floating',
    '--ob-radius-dialog',
    '--ob-radius-dialog-compact',
] as const;

const SHADOW_VARIABLES = [
    '--ob-shadow-control',
    '--ob-shadow-surface',
    '--ob-shadow-floating',
    '--ob-shadow-dialog',
    '--ob-shadow-dialog-compact',
    '--ob-shadow-dialog-form',
    '--ob-shadow-dialog-inspect',
    '--ob-shadow-dialog-confirm',
    '--ob-shadow-shell-control',
] as const;

const LENGTH_VARIABLES = ['--ob-border-control-width', '--ob-border-surface-width'] as const;

const FONT_VARIABLES = ['--ob-font-ui', '--ob-font-editor', '--ob-font-graph'] as const;
const BORDER_STYLE_VARIABLES = ['--ob-border-style'] as const;

function entries(names: readonly string[], kind: ThemeVariableKind) {
    return names.map((name) => [name, kind] as const);
}

export const THEME_VARIABLE_KINDS: Readonly<Record<string, ThemeVariableKind>> = Object.fromEntries([
    ...entries(COLOR_VARIABLES, 'color'),
    ...entries(RADIUS_VARIABLES, 'radius'),
    ...entries(SHADOW_VARIABLES, 'shadow'),
    ...entries(LENGTH_VARIABLES, 'length'),
    ...entries(FONT_VARIABLES, 'font'),
    ...entries(BORDER_STYLE_VARIABLES, 'borderStyle'),
]);

export const THEME_VARIABLE_NAMES = Object.freeze(Object.keys(THEME_VARIABLE_KINDS));
const THEME_TEXTURES: readonly ThemeTexture[] = ['none', 'paper', 'grid', 'dots'];
const THEME_VARIABLE_NAME_SET = new Set(THEME_VARIABLE_NAMES);

export function isThemeVariableName(value: string) {
    return THEME_VARIABLE_NAME_SET.has(value);
}

export function isThemeTexture(value: unknown): value is ThemeTexture {
    return typeof value === 'string' && THEME_TEXTURES.includes(value as ThemeTexture);
}
