import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from './Button';

describe('<Button />', () => {
    it('exposes a busy disabled state while loading and blocks interaction', async () => {
        const user = userEvent.setup();
        const handleClick = vi.fn();

        render(
            <Button isLoading onClick={handleClick}>
                Capture
            </Button>,
        );

        const button = screen.getByRole('button', { name: 'Capture' });

        await user.click(button);

        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(handleClick).not.toHaveBeenCalled();
    });

    it('composes its behavior onto a child link', () => {
        render(
            <Button asChild variant="ghost">
                <a href="/notes/7">Open note</a>
            </Button>,
        );

        expect(screen.getByRole('link', { name: 'Open note' })).toHaveAttribute('href', '/notes/7');
    });
});
