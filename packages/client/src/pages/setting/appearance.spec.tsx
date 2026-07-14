import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToastProvider } from '~/components/ui';
import { downloadBlobFile } from '~/modules/file-download';
import { MAX_THEME_FILE_BYTES } from '~/modules/theme-package';
import { createThemeRegistry, DEFAULT_PREFERRED_THEMES, resolveAppliedTheme } from '~/modules/theme-runtime';
import { useTheme } from '~/store/theme';
import { SKETCHBOOK_DARK_THEME_ID, SKETCHBOOK_LIGHT_THEME_ID, STUDIO_LIGHT_THEME_ID } from '~/themes/builtin-themes';
import Appearance from './appearance';

vi.mock('~/modules/file-download', () => ({ downloadBlobFile: vi.fn() }));

const originalState = useTheme.getState();

function resetThemeStore() {
    const registry = createThemeRegistry();
    useTheme.setState({
        ...originalState,
        activeTheme: resolveAppliedTheme(registry, STUDIO_LIGHT_THEME_ID, 'light'),
        colorMode: 'light',
        explicitTheme: 'light',
        installedThemePackages: [],
        overrides: {},
        preferredThemes: { ...DEFAULT_PREFERRED_THEMES },
        previewThemeId: null,
        registry,
        systemTheme: 'light',
        theme: 'light',
    });
}

function renderPage() {
    return render(
        <ToastProvider>
            <Appearance />
        </ToastProvider>,
    );
}

describe('<Appearance />', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        resetThemeStore();
    });

    afterEach(() => {
        useTheme.setState(originalState);
        document.documentElement.className = '';
        document.documentElement.removeAttribute('data-theme-id');
        document.documentElement.removeAttribute('data-theme-texture');
        document.documentElement.removeAttribute('style');
    });

    it('restores the selected theme when a preview is cancelled', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: 'Preview Sketchbook' }));

        expect(screen.getByText('Previewing Sketchbook')).toBeInTheDocument();
        expect(useTheme.getState().preferredThemes.light).toBe(STUDIO_LIGHT_THEME_ID);
        expect(document.documentElement.dataset.themeId).toBe(SKETCHBOOK_LIGHT_THEME_ID);

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByText('Previewing Sketchbook')).not.toBeInTheDocument();
        expect(document.documentElement.dataset.themeId).toBe(STUDIO_LIGHT_THEME_ID);
    });

    it('commits a preview from the theme gallery', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: 'Preview Sketchbook' }));
        await user.click(screen.getByRole('button', { name: 'Apply' }));

        expect(useTheme.getState().preferredThemes).toEqual({
            light: SKETCHBOOK_LIGHT_THEME_ID,
            dark: SKETCHBOOK_DARK_THEME_ID,
        });
        expect(useTheme.getState().previewThemeId).toBeNull();
        expect(screen.getByText('Customize Sketchbook Light')).toBeInTheDocument();
    });

    it('presents the theme set before its mode controls', () => {
        renderPage();

        const themeSetHeading = screen.getByRole('heading', { name: 'Theme set' });
        const colorModeHeading = screen.getByRole('heading', { name: 'Color mode' });

        expect(themeSetHeading.compareDocumentPosition(colorModeHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
        expect(themeSetHeading.closest('section')).toBe(colorModeHeading.closest('section'));
    });

    it('keeps both color modes inside the selected theme set', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: 'Preview Sketchbook' }));
        await user.click(screen.getByRole('button', { name: 'Apply' }));
        await user.click(screen.getByRole('button', { name: 'Dark', exact: true }));

        expect(useTheme.getState().preferredThemes).toEqual({
            light: SKETCHBOOK_LIGHT_THEME_ID,
            dark: SKETCHBOOK_DARK_THEME_ID,
        });
        expect(useTheme.getState().activeTheme.fullId).toBe(SKETCHBOOK_DARK_THEME_ID);
        expect(screen.queryByRole('combobox', { name: /theme/i })).not.toBeInTheDocument();
    });

    it('stores roundness as a sparse override', () => {
        renderPage();
        const slider = screen.getByRole('slider', { name: 'Standard control roundness' });

        fireEvent.input(slider, { target: { value: '15' } });

        expect(useTheme.getState().overrides[STUDIO_LIGHT_THEME_ID]).toEqual({
            '--ob-radius-control-md': '15px',
        });
    });

    it('rolls a preview back when the appearance page unmounts', async () => {
        const user = userEvent.setup();
        const view = renderPage();

        await user.click(screen.getByRole('button', { name: 'Preview Sketchbook' }));
        view.unmount();

        expect(useTheme.getState().previewThemeId).toBeNull();
        expect(document.documentElement.dataset.themeId).toBe(STUDIO_LIGHT_THEME_ID);
    });

    it('imports a valid package and opens its matching preview', async () => {
        const user = userEvent.setup();
        const importedPackage = {
            schemaVersion: 1,
            id: 'example.forest',
            name: 'Forest',
            version: '1.0.0',
            themes: [
                {
                    id: 'light',
                    label: 'Forest Light',
                    appearance: 'light',
                    variables: {
                        '--surface': '#ffffff',
                        '--fg-default': '#172217',
                        '--cta': '#172217',
                        '--fg-on-filled': '#ffffff',
                    },
                },
                {
                    id: 'dark',
                    label: 'Forest Dark',
                    appearance: 'dark',
                },
            ],
        };
        const file = new File([JSON.stringify(importedPackage)], 'forest.obtheme.json', {
            type: 'application/json',
        });
        Object.defineProperty(file, 'text', {
            value: () => Promise.resolve(JSON.stringify(importedPackage)),
        });
        renderPage();

        await user.upload(screen.getByLabelText('Import theme package'), file);

        expect(await screen.findByText('Previewing Forest')).toBeInTheDocument();
        expect(useTheme.getState().installedThemePackages).toHaveLength(1);
    });

    it('rejects an oversized package before reading its contents', async () => {
        const user = userEvent.setup();
        const file = new File(['x'.repeat(MAX_THEME_FILE_BYTES + 1)], 'oversized.obtheme.json', {
            type: 'application/json',
        });
        const readFile = vi.fn(() => Promise.resolve('{}'));
        Object.defineProperty(file, 'text', { value: readFile });
        renderPage();

        await user.upload(screen.getByLabelText('Import theme package'), file);

        expect(readFile).not.toHaveBeenCalled();
        expect(useTheme.getState().installedThemePackages).toHaveLength(0);
        expect(await screen.findByText('Theme files cannot exceed 64 KB.')).toBeInTheDocument();
    });

    it('reports a theme file read failure', async () => {
        const user = userEvent.setup();
        const file = new File(['{}'], 'unreadable.obtheme.json', { type: 'application/json' });
        Object.defineProperty(file, 'text', { value: () => Promise.reject(new Error('read failed')) });
        renderPage();

        await user.upload(screen.getByLabelText('Import theme package'), file);

        expect(await screen.findByText('Theme file could not be read.')).toBeInTheDocument();
        expect(useTheme.getState().installedThemePackages).toHaveLength(0);
    });

    it('does not finish an import after the appearance page unmounts', async () => {
        const user = userEvent.setup();
        const importedPackage = {
            schemaVersion: 1,
            id: 'example.late',
            name: 'Late',
            version: '1.0.0',
            themes: [
                { id: 'light', label: 'Late Light', appearance: 'light' },
                { id: 'dark', label: 'Late Dark', appearance: 'dark' },
            ],
        };
        let finishReading: (value: string) => void = () => undefined;
        const contents = new Promise<string>((resolve) => {
            finishReading = resolve;
        });
        const file = new File(['{}'], 'late.obtheme.json', { type: 'application/json' });
        Object.defineProperty(file, 'text', { value: () => contents });
        const view = renderPage();

        await user.upload(screen.getByLabelText('Import theme package'), file);
        view.unmount();
        await act(async () => {
            finishReading(JSON.stringify(importedPackage));
            await contents;
        });

        expect(useTheme.getState().installedThemePackages).toHaveLength(0);
        expect(useTheme.getState().previewThemeId).toBeNull();
    });

    it('exports the active theme as an obtheme file', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: /Export/ }));

        await waitFor(() => {
            expect(downloadBlobFile).toHaveBeenCalledWith(expect.any(Blob), 'studio-custom.obtheme.json');
        });
    });
});
