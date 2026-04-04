import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from './Dialog';
import { Dropdown } from '../Dropdown';

describe('<DialogContent />', () => {
    it('renders dialog content with its accessible title and description', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Title</DialogTitle>
                    <DialogDescription>Body</DialogDescription>
                </DialogContent>
            </Dialog>
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Body')).toBeInTheDocument();
    });
});

describe('<Dropdown />', () => {
    it('opens the menu and invokes the selected action', async () => {
        const user = userEvent.setup();
        const handleArchive = vi.fn();

        render(
            <Dropdown
                button={(
                    <button
                        type="button"
                        className="focus-ring-soft rounded-[12px] border border-border-subtle px-3 py-2">
                        Open menu
                    </button>
                )}
                items={[{
                    name: 'Archive',
                    onClick: handleArchive
                }]}
            />
        );

        const trigger = screen.getByRole('button', { name: 'Open menu' });
        expect(trigger).toBeInTheDocument();

        await user.click(trigger);

        const item = screen.getByRole('menuitem', { name: 'Archive' });
        expect(item).toBeInTheDocument();

        await user.click(item);

        expect(handleArchive).toHaveBeenCalledTimes(1);
    });
});
