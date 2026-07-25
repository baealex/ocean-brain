import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RichCodePreview } from './RichCodePreview';

const renderRichCodeMock = vi.hoisted(() => vi.fn());

vi.mock('~/modules/rich-code-renderer', () => ({
    renderRichCode: renderRichCodeMock,
}));

const originalIntersectionObserver = globalThis.IntersectionObserver;

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
        expect(renderRichCodeMock).toHaveBeenCalledWith('mermaid', 'graph TD; A-->B', expect.any(String));
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
});
