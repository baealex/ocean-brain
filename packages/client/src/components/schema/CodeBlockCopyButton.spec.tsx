import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CodeBlockCopyButton } from './CodeBlockCopyButton';

const mockClipboard = (writeText: (text: string) => Promise<void>) => {
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
};

describe('CodeBlockCopyButton', () => {
    it('copies code text and resets the copied state', async () => {
        const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const user = userEvent.setup();
        mockClipboard(writeText);

        render(<CodeBlockCopyButton getText={() => 'const value = 1;'} resetDelayMs={50} />);

        await user.click(screen.getByRole('button', { name: 'Copy' }));

        expect(writeText).toHaveBeenCalledWith('const value = 1;');
        expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();

        await waitFor(() => expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument());
    });

    it('shows a failure state when clipboard writing fails', async () => {
        const writeText = vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('Clipboard failed'));
        const user = userEvent.setup();
        mockClipboard(writeText);

        render(<CodeBlockCopyButton getText={() => 'const value = 1;'} />);

        await user.click(screen.getByRole('button', { name: 'Copy' }));

        expect(await screen.findByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
    });
});
