import { render, screen } from '@testing-library/react';

import { Button } from './Button';

describe('<Button />', () => {
    it('uses the new neutral primary surface instead of sketchy classes', () => {
        render(<Button>Capture</Button>);

        const button = screen.getByRole('button', { name: 'Capture' });
        expect(button.className).toContain('rounded-[18px]');
        expect(button.className).toContain('focus-ring-soft');
        expect(button.className).not.toContain('shadow-sketchy');
        expect(button.className).not.toContain('rounded-[12px_4px_13px_3px/4px_10px_4px_12px]');
    });
});
