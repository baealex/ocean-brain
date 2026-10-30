import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LayoutModal from './LayoutModal';

describe('<LayoutModal />', () => {
    it('marks the current layout as the selected option', () => {
        render(<LayoutModal isOpen currentLayout="narrow" onClose={vi.fn()} onSave={vi.fn()} />);

        expect(screen.getByRole('button', { name: /Narrow/, pressed: true })).toBeInTheDocument();
    });

    it('moves the selected state to the option the user picks', async () => {
        const user = userEvent.setup();
        render(<LayoutModal isOpen currentLayout="narrow" onClose={vi.fn()} onSave={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: /Full Width/ }));

        expect(screen.getByRole('button', { name: /Full Width/, pressed: true })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Narrow/, pressed: false })).toBeInTheDocument();
    });

    it('applies the chosen layout', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();
        render(<LayoutModal isOpen currentLayout="wide" onClose={vi.fn()} onSave={onSave} />);

        await user.click(screen.getByRole('button', { name: /Full Width/ }));
        await user.click(screen.getByRole('button', { name: 'Apply' }));

        expect(onSave).toHaveBeenCalledWith('full');
    });
});
