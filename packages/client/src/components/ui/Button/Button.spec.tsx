import { fireEvent, render, screen } from '@testing-library/react';

import { Button } from './Button';

describe('<Button />', () => {
    it('renders an accessible button and calls the click handler', () => {
        const handleClick = vi.fn();

        render(<Button onClick={handleClick}>Capture</Button>);

        const button = screen.getByRole('button', { name: 'Capture' });
        expect(button).toBeInTheDocument();

        fireEvent.click(button);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('respects the disabled state regardless of visual variant', () => {
        render(
            <>
                <Button disabled>Primary action</Button>
                <Button variant="subtle" disabled>Quiet action</Button>
            </>
        );

        const primaryButton = screen.getByRole('button', { name: 'Primary action' });
        const subtleButton = screen.getByRole('button', { name: 'Quiet action' });

        expect(primaryButton).toBeDisabled();
        expect(subtleButton).toBeDisabled();
    });
});
