import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './CodeBlock';

vi.mock('./RichCodePreview', () => ({
    RichCodePreview: ({ source }: { source: string }) => <div aria-label="rich preview">{source}</div>,
}));

const renderCodeBlock = (language: string, source: string) => {
    const contentRef = vi.fn();
    const props = {
        block: {
            id: 'code-block',
            type: 'codeBlock',
            props: { language },
            content: [{ type: 'text', text: source, styles: {} }],
            children: [],
        },
        contentRef,
        editor: {},
    };

    const result = render(<CodeBlock {...(props as never)} />);
    return { ...result, contentRef };
};

describe('CodeBlock', () => {
    it('shows a rich preview by default and keeps the editable source mounted', async () => {
        const user = userEvent.setup();
        const { container, contentRef } = renderCodeBlock('mermaid', 'graph TD; A-->B');

        expect(screen.getByLabelText('rich preview')).toHaveTextContent('graph TD; A-->B');
        expect(container.querySelector('pre')).toHaveClass('hidden');
        expect(contentRef).toHaveBeenCalledWith(expect.any(HTMLElement));

        await user.click(screen.getByRole('button', { name: 'Edit source' }));

        expect(screen.queryByLabelText('rich preview')).not.toBeInTheDocument();
        expect(container.querySelector('pre')).not.toHaveClass('hidden');
        expect(screen.getByRole('button', { name: 'Show preview' })).toBeInTheDocument();
    });

    it('leaves ordinary code blocks unchanged', () => {
        const { container } = renderCodeBlock('typescript', 'const value = 1;');

        expect(screen.queryByLabelText('rich preview')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit source' })).not.toBeInTheDocument();
        expect(container.querySelector('pre')).not.toHaveClass('hidden');
    });

    it('keeps a newly created rich block editable and previews its live DOM source', async () => {
        const user = userEvent.setup();
        const { container } = renderCodeBlock('mermaid', '');

        expect(screen.queryByLabelText('rich preview')).not.toBeInTheDocument();
        expect(container.querySelector('pre')).not.toHaveClass('hidden');
        expect(screen.getByRole('button', { name: 'Show preview' })).toBeInTheDocument();

        act(() => {
            const code = container.querySelector('code');

            if (code) {
                code.textContent = 'graph TD; Live-->Preview';
            }
        });
        await user.click(screen.getByRole('button', { name: 'Show preview' }));

        expect(screen.getByLabelText('rich preview')).toHaveTextContent('graph TD; Live-->Preview');
    });
});
