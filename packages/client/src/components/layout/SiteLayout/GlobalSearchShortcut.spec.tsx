import { fireEvent, render, screen } from '@testing-library/react';

import { SEARCH_ROUTE } from '~/modules/url';

import GlobalSearchShortcut from './GlobalSearchShortcut';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
}));

describe('<GlobalSearchShortcut />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens a fresh detailed search with Meta+K or Ctrl+K', () => {
        render(<GlobalSearchShortcut />);

        fireEvent.keyDown(window, { key: 'k', metaKey: true });
        fireEvent.keyDown(window, { key: 'K', ctrlKey: true });

        expect(mockNavigate).toHaveBeenNthCalledWith(1, {
            to: SEARCH_ROUTE,
            search: { query: '', page: 1, mode: 'hybrid' },
        });
        expect(mockNavigate).toHaveBeenNthCalledWith(2, {
            to: SEARCH_ROUTE,
            search: { query: '', page: 1, mode: 'hybrid' },
        });
    });

    it('does not interrupt text entry in editable controls', () => {
        render(
            <>
                <GlobalSearchShortcut />
                <input aria-label="Note title" />
            </>,
        );

        const input = document.querySelector('input');
        fireEvent.keyDown(input as HTMLInputElement, { key: 'k', metaKey: true });

        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not steal the shortcut from active controls or dialogs', () => {
        render(
            <>
                <GlobalSearchShortcut />
                <button type="button">Open menu</button>
                <div role="dialog">Dialog content</div>
            </>,
        );

        fireEvent.keyDown(screen.getByRole('button', { name: 'Open menu' }), { key: 'k', metaKey: true });
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'k', ctrlKey: true });

        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('respects a shortcut event already handled by another control', () => {
        render(<GlobalSearchShortcut />);

        const event = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'k',
            metaKey: true,
        });
        event.preventDefault();
        window.dispatchEvent(event);

        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
