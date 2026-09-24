// Only public visual tokens cross the iframe boundary. App code stays sandboxed.
const APP_COLOR_TOKENS = [
    '--page-bg',
    '--surface',
    '--muted',
    '--elevated',
    '--hover',
    '--hover-subtle',
    '--fg-default',
    '--fg-secondary',
    '--fg-tertiary',
    '--fg-placeholder',
    '--fg-error',
    '--fg-on-filled',
    '--border',
    '--border-secondary',
    '--border-subtle',
    '--border-focus',
    '--border-error',
    '--accent-soft-primary',
    '--accent-soft-danger',
    '--cta',
    '--cta-hover',
    '--highlight',
    '--highlight-fg',
] as const;

export function getIntegrationAppAppearance() {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
        theme: root.classList.contains('dark') ? 'dark' : 'light',
        fontFamily: getComputedStyle(document.body).fontFamily,
        variables: Object.fromEntries(APP_COLOR_TOKENS.map((token) => [token, style.getPropertyValue(token).trim()])),
    };
}
