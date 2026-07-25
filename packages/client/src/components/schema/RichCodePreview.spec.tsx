import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '~/store/theme';
import { RichCodePreview } from './RichCodePreview';

const renderRichCodeMock = vi.hoisted(() => vi.fn());

vi.mock('~/modules/rich-code-renderer', () => ({
    renderRichCode: renderRichCodeMock,
}));

const originalIntersectionObserver = globalThis.IntersectionObserver;

beforeEach(() => {
    useTheme.setState({ theme: 'light', explicitTheme: 'light' });
});

afterEach(() => {
    Object.defineProperty(globalThis, 'IntersectionObserver', {
        configurable: true,
        value: originalIntersectionObserver,
    });
});

describe('RichCodePreview', () => {
    it('loads the renderer only when the preview approaches the viewport', async () => {
        let intersectionCallback: IntersectionObserverCallback | undefined;
        const disconnect = vi.fn();

        Object.defineProperty(globalThis, 'IntersectionObserver', {
            configurable: true,
            value: class {
                constructor(callback: IntersectionObserverCallback) {
                    intersectionCallback = callback;
                }

                observe = vi.fn();
                disconnect = disconnect;
            },
        });
        renderRichCodeMock.mockResolvedValue({ html: '<svg data-testid="rendered-diagram"></svg>' });

        render(<RichCodePreview kind="mermaid" source="graph TD; A-->B" />);

        expect(renderRichCodeMock).not.toHaveBeenCalled();

        await act(async () => {
            intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
        });

        expect(await screen.findByTestId('rendered-diagram')).toBeInTheDocument();
        expect(renderRichCodeMock).toHaveBeenCalledWith('mermaid', 'graph TD; A-->B', expect.any(String), 'light');
        expect(disconnect).toHaveBeenCalled();
    });

    it('falls back to readable source when rendering fails', async () => {
        Object.defineProperty(globalThis, 'IntersectionObserver', {
            configurable: true,
            value: undefined,
        });
        renderRichCodeMock.mockRejectedValue(new Error('Invalid formula'));

        render(<RichCodePreview kind="math" source={String.raw`\frac{`} />);

        expect(await screen.findByText('Preview could not be rendered. The source is preserved.')).toBeInTheDocument();
        expect(screen.getByText(String.raw`\frac{`)).toBeInTheDocument();
    });

    it('rerenders previews when the application theme changes', async () => {
        Object.defineProperty(globalThis, 'IntersectionObserver', {
            configurable: true,
            value: undefined,
        });
        renderRichCodeMock.mockResolvedValue({ html: '<svg data-testid="themed-diagram"></svg>' });

        render(<RichCodePreview kind="mermaid" source="graph TD; A-->B" />);

        await waitFor(() =>
            expect(renderRichCodeMock).toHaveBeenLastCalledWith(
                'mermaid',
                'graph TD; A-->B',
                expect.any(String),
                'light',
            ),
        );

        act(() => useTheme.setState({ theme: 'dark', explicitTheme: 'dark' }));

        await waitFor(() =>
            expect(renderRichCodeMock).toHaveBeenLastCalledWith(
                'mermaid',
                'graph TD; A-->B',
                expect.any(String),
                'dark',
            ),
        );
    });
});
