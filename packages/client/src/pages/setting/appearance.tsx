import { useEffect, useMemo, useRef, useState } from 'react';

import * as Icon from '~/components/icon';
import { Button, PageLayout } from '~/components/shared';
import { Input, Text, useToast } from '~/components/ui';
import type { RegisteredTheme, Theme, ThemeColorMode, ThemePackage } from '~/models/theme.model';
import { downloadBlobFile } from '~/modules/file-download';
import { MAX_INSTALLED_THEME_PACKAGES, MAX_THEME_FILE_BYTES, parseThemePackage } from '~/modules/theme-package';
import {
    createPortableThemePackage,
    createThemeDownload,
    getRegisteredTheme,
    getThemeFullId,
    isBuiltInThemePackage,
} from '~/modules/theme-runtime';
import { useTheme } from '~/store/theme';

const previewDefaults = {
    light: { accent: '#5d6672', page: '#f2f5f8', surface: '#f7f8fa', text: '#202631' },
    dark: { accent: '#b8c0ca', page: '#101318', surface: '#16191e', text: '#e6ebf2' },
} as const;

function getPreviewStyle(theme: RegisteredTheme) {
    const defaults = previewDefaults[theme.appearance];
    const variables = theme.variables ?? {};
    return {
        accent: variables['--accent-primary'] ?? defaults.accent,
        page: variables['--page-bg'] ?? defaults.page,
        radius: variables['--ob-radius-surface'] ?? '16px',
        surface: variables['--surface'] ?? defaults.surface,
        text: variables['--fg-default'] ?? defaults.text,
    };
}

function toColorInputValue(value: string) {
    const hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
        return `#${[...hex.slice(0, 3)].map((character) => character.repeat(2)).join('')}`;
    }
    return `#${hex.slice(0, 6)}`;
}

interface ThemePreviewProps {
    appearance: Theme;
    theme?: RegisteredTheme;
}

function ThemePreview({ appearance, theme }: ThemePreviewProps) {
    const preview = theme
        ? getPreviewStyle(theme)
        : {
              ...previewDefaults[appearance],
              radius: '16px',
          };

    return (
        <div className="relative h-24 p-3" style={{ backgroundColor: preview.page }}>
            <Text
                as="span"
                variant="micro"
                weight="semibold"
                transform="uppercase"
                className="absolute left-3 top-2 opacity-70"
                style={{ color: preview.text }}
            >
                {appearance}
            </Text>
            <div
                className="mt-3 h-14 border p-2 shadow-sm"
                style={{
                    backgroundColor: preview.surface,
                    borderColor: preview.accent,
                    borderRadius: preview.radius,
                    color: preview.text,
                }}
            >
                <div className="mb-2 h-1.5 w-1/2 rounded-full opacity-70" style={{ backgroundColor: preview.text }} />
                <div className="h-3 w-10 rounded-md" style={{ backgroundColor: preview.accent }} />
            </div>
            {!theme && (
                <span className="absolute inset-0 flex items-center justify-center bg-overlay/20">
                    <Text as="span" variant="label" weight="semibold" className="rounded-full bg-surface px-2 py-1">
                        Not included
                    </Text>
                </span>
            )}
        </div>
    );
}

interface ThemePackageCardProps {
    isPreferred: boolean;
    isPreviewing: boolean;
    onPreview: () => void;
    onRemove?: () => void;
    themePackage: ThemePackage;
    themes: RegisteredTheme[];
}

function ThemePackageCard({
    isPreferred,
    isPreviewing,
    onPreview,
    onRemove,
    themePackage,
    themes,
}: ThemePackageCardProps) {
    const lightTheme = themes.find((theme) => theme.appearance === 'light');
    const darkTheme = themes.find((theme) => theme.appearance === 'dark');
    const canPreview = Boolean(lightTheme && darkTheme);

    return (
        <article className="surface-base overflow-hidden">
            <button
                type="button"
                aria-label={`Preview ${themePackage.name}`}
                aria-pressed={isPreviewing}
                onClick={onPreview}
                disabled={!canPreview}
                title={canPreview ? undefined : 'Theme sets require both light and dark styles.'}
                className="focus-ring-soft block w-full text-left outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
                <div className="grid grid-cols-2 divide-x divide-border-subtle border-b border-border-subtle">
                    <ThemePreview appearance="light" theme={lightTheme} />
                    <ThemePreview appearance="dark" theme={darkTheme} />
                </div>
                <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                    <div className="min-w-0">
                        <Text as="div" variant="meta" weight="semibold" truncate>
                            {themePackage.name}
                        </Text>
                        <Text as="div" variant="label" tone="tertiary" truncate>
                            Light & dark
                            {themePackage.author ? ` · ${themePackage.author}` : ''}
                        </Text>
                    </div>
                    {isPreferred && (
                        <Icon.Check className="h-4 w-4 shrink-0 text-accent-success" aria-label="Selected" />
                    )}
                </div>
            </button>
            {onRemove && (
                <div className="border-t border-border-subtle px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={onRemove}>
                        Remove
                    </Button>
                </div>
            )}
        </article>
    );
}

const Appearance = () => {
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isMountedRef = useRef(false);
    const [search, setSearch] = useState('');
    const [previewPackageId, setPreviewPackageId] = useState<string | null>(null);
    const {
        activeTheme,
        cancelThemePreview,
        colorMode,
        installThemePackage,
        installedThemePackages,
        overrides,
        preferredThemes,
        previewTheme,
        previewThemeId,
        registry,
        removeThemePackage,
        resetAppearance,
        resetThemeOverrides,
        setColorMode,
        setPreferredThemePackage,
        setThemeOverride,
        systemTheme,
    } = useTheme((state) => state);
    const appearance: Theme = colorMode === 'system' ? systemTheme : colorMode;
    const query = search.trim().toLowerCase();
    const visiblePackages = useMemo(
        () =>
            registry.packages.filter((themePackage) => {
                if (!query) return true;
                const themeLabels = registry.themes
                    .filter((theme) => theme.packageId === themePackage.id)
                    .map((theme) => theme.label)
                    .join(' ');
                return `${themePackage.name} ${themePackage.author ?? ''} ${themePackage.description ?? ''} ${themeLabels}`
                    .toLowerCase()
                    .includes(query);
            }),
        [query, registry.packages, registry.themes],
    );
    const preferredLightTheme = getRegisteredTheme(registry, preferredThemes.light);
    const preferredDarkTheme = getRegisteredTheme(registry, preferredThemes.dark);
    const previewLabel = previewPackageId
        ? (registry.packages.find((themePackage) => themePackage.id === previewPackageId)?.name ?? activeTheme.label)
        : activeTheme.label;
    const accent = activeTheme.variables['--accent-primary'] ?? previewDefaults[appearance].accent;
    const roundness = Number.parseFloat(activeTheme.variables['--ob-radius-control-md'] ?? '14');

    const getPackageTheme = (packageId: string, targetAppearance: Theme) => {
        return (
            registry.themes.find((theme) => theme.packageId === packageId && theme.appearance === targetAppearance) ??
            null
        );
    };

    const isPreferredPackage = (themePackage: ThemePackage) => {
        return preferredLightTheme?.packageId === themePackage.id && preferredDarkTheme?.packageId === themePackage.id;
    };

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            cancelThemePreview();
        };
    }, [cancelThemePreview]);

    useEffect(() => {
        if (!previewThemeId) setPreviewPackageId(null);
    }, [previewThemeId]);

    useEffect(() => {
        if (!previewThemeId) return;
        const cancelOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPreviewPackageId(null);
                cancelThemePreview();
            }
        };
        window.addEventListener('keydown', cancelOnEscape);
        return () => window.removeEventListener('keydown', cancelOnEscape);
    }, [cancelThemePreview, previewThemeId]);

    const previewPackage = (packageId: string) => {
        const theme = getPackageTheme(packageId, appearance);
        if (!theme) return;
        setPreviewPackageId(packageId);
        previewTheme(theme.fullId);
    };

    const cancelPreview = () => {
        setPreviewPackageId(null);
        cancelThemePreview();
    };

    const applyPreview = () => {
        if (!previewPackageId) return;
        setPreferredThemePackage(previewPackageId);
        setPreviewPackageId(null);
    };

    const importTheme = async (file?: File) => {
        if (!file) return;
        if (file.size > MAX_THEME_FILE_BYTES) {
            toast(`Theme files cannot exceed ${MAX_THEME_FILE_BYTES / 1024} KB.`);
            return;
        }
        let contents: string;
        try {
            contents = await file.text();
        } catch {
            if (isMountedRef.current) toast('Theme file could not be read.');
            return;
        }
        if (!isMountedRef.current) return;
        const result = parseThemePackage(contents);
        if (!result.ok) {
            toast(result.issues.find((issue) => issue.severity === 'error')?.message ?? 'Theme import failed.');
            return;
        }
        if (isBuiltInThemePackage(result.value.id)) {
            toast('Built-in themes cannot be replaced.');
            return;
        }
        const isUpdate = installedThemePackages.some((item) => item.id === result.value.id);
        if (!isUpdate && installedThemePackages.length >= MAX_INSTALLED_THEME_PACKAGES) {
            toast(`You can install up to ${MAX_INSTALLED_THEME_PACKAGES} theme packages.`);
            return;
        }

        installThemePackage(result.value);
        const importedTheme = result.value.themes.find((theme) => theme.appearance === appearance);
        if (importedTheme) {
            setPreviewPackageId(result.value.id);
            previewTheme(getThemeFullId(result.value.id, importedTheme.id));
        }
        const warning = result.issues.find((issue) => issue.severity === 'warning');
        toast(
            warning?.message ??
                `${result.value.name} installed${importedTheme ? '.' : `; switch to ${result.value.themes[0].appearance} to preview.`}`,
        );
    };

    const exportTheme = () => {
        const themePackage = createPortableThemePackage(registry, activeTheme.fullId, overrides);
        if (!themePackage) {
            toast('This theme cannot be exported until its invalid customizations are reset.');
            return;
        }
        const download = createThemeDownload(themePackage);
        downloadBlobFile(download.blob, download.filename);
    };

    return (
        <PageLayout
            title="Appearance"
            description="Choose a theme set for your workspace. Its light and dark styles stay together."
            headerRight={
                <div className="flex gap-2">
                    <Button variant="subtle" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Icon.Upload className="h-4 w-4" /> Import
                    </Button>
                    <Button variant="subtle" size="sm" onClick={exportTheme}>
                        <Icon.Download className="h-4 w-4" /> Export
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,.obtheme.json,application/json"
                        aria-label="Import theme package"
                        className="hidden"
                        onChange={(event) => {
                            void importTheme(event.currentTarget.files?.[0]);
                            event.currentTarget.value = '';
                        }}
                    />
                </div>
            }
        >
            <div className="space-y-6">
                <section className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <Text as="h2" variant="body" weight="semibold">
                                Theme set
                            </Text>
                            <Text as="p" variant="label" tone="tertiary" className="mt-1">
                                Choose the overall look first. Each set includes its light and dark styles.
                            </Text>
                        </div>
                        <div className="w-full sm:w-52 sm:flex-none">
                            <Input
                                size="sm"
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.currentTarget.value)}
                                placeholder="Search themes"
                                aria-label="Search themes"
                            />
                        </div>
                    </div>
                    {visiblePackages.length ? (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {visiblePackages.map((themePackage) => {
                                const themes = registry.themes.filter((theme) => theme.packageId === themePackage.id);
                                return (
                                    <ThemePackageCard
                                        key={themePackage.id}
                                        themePackage={themePackage}
                                        themes={themes}
                                        isPreferred={isPreferredPackage(themePackage)}
                                        isPreviewing={previewPackageId === themePackage.id && previewThemeId !== null}
                                        onPreview={() => previewPackage(themePackage.id)}
                                        onRemove={
                                            isBuiltInThemePackage(themePackage.id)
                                                ? undefined
                                                : () => {
                                                      setPreviewPackageId(null);
                                                      removeThemePackage(themePackage.id);
                                                  }
                                        }
                                    />
                                );
                            })}
                        </div>
                    ) : (
                        <div className="surface-base p-8 text-center">
                            <Text as="p" variant="meta" tone="secondary">
                                No matching themes.
                            </Text>
                        </div>
                    )}

                    <div className="surface-base flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <Text as="h3" variant="meta" weight="semibold">
                                Color mode
                            </Text>
                            <Text as="p" variant="label" tone="tertiary" className="mt-0.5">
                                Switch the selected set between its light and dark styles.
                            </Text>
                        </div>
                        <div
                            className="surface-base inline-flex w-fit shrink-0 self-end gap-1 p-1 sm:self-auto"
                            role="group"
                            aria-label="Color mode"
                        >
                            {(['system', 'light', 'dark'] as const).map((mode: ThemeColorMode) => (
                                <Button
                                    key={mode}
                                    size="sm"
                                    variant={colorMode === mode ? 'signature' : 'ghost'}
                                    aria-pressed={colorMode === mode}
                                    onClick={() => setColorMode(mode)}
                                >
                                    {mode === 'system' && <Icon.Desktop className="h-4 w-4" />}
                                    {mode === 'light' && <Icon.Sun className="h-4 w-4" />}
                                    {mode === 'dark' && <Icon.Moon className="h-4 w-4" />}
                                    {mode[0].toUpperCase() + mode.slice(1)}
                                </Button>
                            ))}
                        </div>
                    </div>
                </section>

                {previewThemeId ? (
                    <section className="surface-floating sticky bottom-4 z-20 flex items-center justify-between gap-3 px-4 py-3">
                        <Text as="p" variant="meta" weight="medium">
                            Previewing {previewLabel}
                        </Text>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={cancelPreview}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={applyPreview}>
                                Apply
                            </Button>
                        </div>
                    </section>
                ) : (
                    <section className="surface-base space-y-4 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <Text as="h2" variant="body" weight="semibold">
                                Customize {activeTheme.label}
                            </Text>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={!overrides[activeTheme.fullId]}
                                onClick={() => resetThemeOverrides(activeTheme.fullId)}
                            >
                                Reset
                            </Button>
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <label className="space-y-2">
                                <Text as="span" variant="meta" weight="medium">
                                    Primary accent
                                </Text>
                                <span className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={toColorInputValue(accent)}
                                        aria-label="Primary accent"
                                        onChange={(event) =>
                                            setThemeOverride(
                                                activeTheme.fullId,
                                                '--accent-primary',
                                                event.currentTarget.value,
                                            )
                                        }
                                        className="theme-radius-control-sm h-9 w-14 cursor-pointer border border-border-subtle bg-elevated p-1"
                                    />
                                    <Text as="span" variant="meta" tone="secondary">
                                        {toColorInputValue(accent)}
                                    </Text>
                                </span>
                            </label>
                            <label className="space-y-2">
                                <Text as="span" variant="meta" weight="medium">
                                    Standard control roundness · {Math.round(roundness)}px
                                </Text>
                                <input
                                    type="range"
                                    min="0"
                                    max="28"
                                    value={roundness}
                                    aria-label="Standard control roundness"
                                    onChange={(event) =>
                                        setThemeOverride(
                                            activeTheme.fullId,
                                            '--ob-radius-control-md',
                                            `${event.currentTarget.value}px`,
                                        )
                                    }
                                    className="w-full accent-[var(--accent-primary)]"
                                />
                            </label>
                        </div>
                    </section>
                )}

                <div className="flex justify-end border-t border-border-subtle pt-4">
                    <Button variant="ghost" size="sm" onClick={resetAppearance}>
                        Reset appearance
                    </Button>
                </div>
            </div>
        </PageLayout>
    );
};

export default Appearance;
