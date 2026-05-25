import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReminderModal from './ReminderModal';

describe('<ReminderModal />', () => {
    it('keeps selected priority text readable inside the dialog', async () => {
        const user = userEvent.setup();

        render(<ReminderModal isOpen mode="create" onClose={vi.fn()} onSave={vi.fn()} />);

        const mediumPriority = screen.getByRole('radio', { name: 'Medium' });

        expect(mediumPriority).toHaveAttribute('aria-checked', 'true');
        expect(mediumPriority.className).toContain('data-[state=on]:text-fg-default');
        expect(mediumPriority.className).not.toContain('data-[state=on]:text-fg-on-filled');

        await user.click(screen.getByRole('radio', { name: 'High' }));

        const highPriority = screen.getByRole('radio', { name: 'High' });

        expect(highPriority).toHaveAttribute('aria-checked', 'true');
        expect(highPriority.className).toContain('data-[state=on]:text-fg-default');
        expect(highPriority.className).not.toContain('data-[state=on]:text-fg-on-filled');
    });
});
