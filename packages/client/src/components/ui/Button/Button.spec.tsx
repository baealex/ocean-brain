import { render, screen } from '@testing-library/react';

import { Button } from './Button';

describe('<Button />', () => {
    it('uses restrained control classes instead of sketchy classes', () => {
        render(<Button>Capture</Button>);

        const button = screen.getByRole('button', { name: 'Capture' });
        expect(button.className).toContain('rounded-[18px]');
        expect(button.className).toContain('focus-ring-soft');
        expect(button.className).not.toContain('shadow-sketchy');
        expect(button.className).not.toContain('rounded-[12px_4px_13px_3px/4px_10px_4px_12px]');
    });

    it('keeps primary as the emphasized CTA and subtle as the quieter neutral option', () => {
        render(
            <>
                <Button>Primary action</Button>
                <Button variant="subtle">Quiet action</Button>
            </>
        );

        const primaryButton = screen.getByRole('button', { name: 'Primary action' });
        const subtleButton = screen.getByRole('button', { name: 'Quiet action' });

        expect(primaryButton.className).toContain('bg-cta');
        expect(primaryButton.className).toContain('text-fg-on-filled');
        expect(subtleButton.className).toContain('bg-subtle');
        expect(subtleButton.className).not.toContain('bg-cta');
    });
});
