import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from './Button';

describe('<Button />', () => {
    it('calls the click handler from the accessible button', async () => {
        const user = userEvent.setup();
        const handleClick = vi.fn();

        render(<Button onClick={handleClick}>Capture</Button>);

        const button = screen.getByRole('button', { name: 'Capture' });
        expect(button).toBeInTheDocument();

        await user.click(button);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('respects the disabled state regardless of visual variant', () => {
        render(
            <>
                <Button disabled>Primary action</Button>
                <Button variant="subtle" disabled>
                    Quiet action
                </Button>
            </>,
        );

        const primaryButton = screen.getByRole('button', { name: 'Primary action' });
        const subtleButton = screen.getByRole('button', { name: 'Quiet action' });

        expect(primaryButton).toBeDisabled();
        expect(subtleButton).toBeDisabled();
    });
});
