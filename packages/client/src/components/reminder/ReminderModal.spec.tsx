import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReminderModal from './ReminderModal';

describe('<ReminderModal />', () => {
    it('saves the selected priority from the dialog controls', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onSave = vi.fn();

        render(<ReminderModal isOpen mode="create" onClose={onClose} onSave={onSave} />);

        const mediumPriority = screen.getByRole('radio', { name: 'Medium' });

        expect(mediumPriority).toHaveAttribute('aria-checked', 'true');

        await user.click(screen.getByRole('radio', { name: 'High' }));

        const highPriority = screen.getByRole('radio', { name: 'High' });

        expect(highPriority).toHaveAttribute('aria-checked', 'true');

        await user.click(screen.getByRole('button', { name: 'Create' }));

        expect(onSave.mock.calls[0]?.[1]).toBe('high');
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
