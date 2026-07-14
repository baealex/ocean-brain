# Ocean Brain Themes

Ocean Brain themes are data-only JSON packages. They can change approved visual variables, but cannot run CSS, JavaScript, load remote URLs, or change application behavior.

> [!IMPORTANT]
> This implementation is an isolated proof of concept. It is not release-ready and should remain off `main` until the visual contract, authoring workflow, and asset policy are settled.

## PoC constraints

- Sketchbook bundles Gaegu only to test whether typography can materially change a theme. It is not a scalable font distribution model.
- Imported packages may reference only safe fonts already available to the application or host. They cannot embed font files or load remote font URLs.
- Productization must not add a bundled font for every theme. Prefer a small app-owned typography palette or a separately managed host font registry while keeping arbitrary remote assets blocked.
- Theme authoring, preview fidelity, token coverage, and migration behavior still need design review before this format is treated as stable.

## Mental model

The theme package is the primary appearance choice. Color mode controls which side of that package is active:

- Selecting a theme package applies its light and dark variants as a pair.
- Color mode is `system`, `light`, or `dark` and switches within the selected package.
- Light and dark themes cannot be selected from different packages.
- `system` follows the operating system and activates the matching side of the selected package.
- Studio is the fallback when a selected or installed theme is unavailable.

The built-in themes are Studio and Sketchbook. Studio inherits the existing application CSS, so it remains the visual and compatibility baseline.

## Package format

Use the `.obtheme.json` suffix and schema version `1`:

```json
{
    "$schema": "https://raw.githubusercontent.com/baealex/ocean-brain/main/packages/client/public/schemas/ocean-brain-theme-v1.schema.json",
    "schemaVersion": 1,
    "id": "example.paper",
    "name": "Paper",
    "version": "1.0.0",
    "author": "Example",
    "themes": [
        {
            "id": "light",
            "label": "Paper Light",
            "appearance": "light",
            "texture": "paper",
            "variables": {
                "--page-bg": "#fdf8f3",
                "--surface": "#fffdf9",
                "--fg-default": "#332f2a",
                "--cta": "#332f2a",
                "--fg-on-filled": "#fffaf3",
                "--accent-primary": "#e8c86f",
                "--ob-radius-surface": "20px"
            }
        },
        {
            "id": "dark",
            "label": "Paper Dark",
            "appearance": "dark",
            "texture": "paper",
            "variables": {
                "--page-bg": "#1d1a17",
                "--surface": "#292521",
                "--fg-default": "#f4eadf",
                "--cta": "#f4eadf",
                "--fg-on-filled": "#292521",
                "--accent-primary": "#e8c86f",
                "--ob-radius-surface": "20px"
            }
        }
    ]
}
```

A package contains exactly one light theme and one dark theme. Each side is complete by itself: missing variables inherit the Studio value for that appearance. This keeps theme sets inseparable, sparse, and portable.

Package IDs use `publisher.name` form, variant IDs use lowercase letters, numbers, and hyphens, and package versions use SemVer.

## Supported values

The public variable list is defined by the [v1 JSON Schema](../packages/client/public/schemas/ocean-brain-theme-v1.schema.json). Runtime validation also enforces each variable type:

- Colors are hexadecimal values, including alpha forms.
- Lengths and radii use bounded `px` values. Irregular elliptical radii are supported.
- Shadows use up to four bounded, hexadecimal-color shadow layers or `none`.
- Fonts may reference safe local or bundled font-family names only.
- Border styles are `solid`, `dashed`, or `dotted`.
- Default and secondary text plus filled, signature, and danger button color pairs must meet a 4.5:1 contrast ratio. Lower-emphasis text has a legibility floor, and focus rings must retain 3:1 contrast against both page and surface backgrounds.

Values containing `url()`, `@import`, `expression()`, `javascript:`, CSS declaration separators, or rule braces are rejected. The exact `$schema` URL is metadata for editor tooling; Ocean Brain does not fetch it at runtime. Theme files are limited to 64 KB, and a browser may store up to 12 imported packages.

## Using themes

Open **Settings → Appearance** to:

- search installed theme packages and compare their light and dark styles together;
- preview a package without saving it and apply both appearances together;
- choose whether the selected package follows the system, stays light, or stays dark;
- apply the preview or cancel it with the button or Escape;
- keep sparse primary-accent and standard-control-roundness adjustments separately from the package;
- import, remove, or export `.obtheme.json` packages;
- reset the current customization or all appearance preferences.

Imported packages and preferences are browser-local. Export merges a package with its sparse user overrides so the result can be imported into another Ocean Brain instance. Customized exports receive a stable fork ID derived from their contents, so importing them does not silently replace the source package and distinct customizations can coexist.

## Compatibility and fallback

The theme system preserves the existing `Theme` type, `useTheme().theme`, `explicitTheme`, `setTheme`, `setSystemTheme`, `toggleTheme`, `html.light/dark`, and `localStorage.theme` behavior. The new appearance record is stored separately and migrates from the legacy key when first loaded.

Theme state is validated and applied before React renders. Invalid stored data, missing packages, removed variants, and unsupported schema versions fall back to Studio without applying untrusted values.

## Adding a built-in theme

Add a `ThemePackage` entry in `packages/client/src/themes/builtin-themes.ts`. Components must consume the stable semantic variables rather than inspect a theme ID. Canvas renderers read their `--ob-graph-*` variables through the graph adapter, while BlockNote and shared UI primitives inherit the same CSS contract.

Server synchronization, remote marketplaces, executable plugins, remote fonts, and arbitrary asset bundles are intentionally outside v1. A future catalog can distribute the same validated JSON package without changing the runtime contract.
