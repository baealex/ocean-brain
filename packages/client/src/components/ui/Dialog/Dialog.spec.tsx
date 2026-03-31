import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from './Dialog';
import { Dropdown } from '../Dropdown';

describe('<DialogContent />', () => {
    it('renders as a floating surface instead of a sketchy card', () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogTitle>Title</DialogTitle>
                    <DialogDescription>Body</DialogDescription>
                </DialogContent>
            </Dialog>
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog.className).toContain('surface-floating');
        expect(dialog.className).not.toContain('shadow-sketchy-lg');
    });
});

describe('<Dropdown />', () => {
    it('applies quiet tool styling to the trigger and menu items', async () => {
        const user = userEvent.setup();

        render(
            <Dropdown
                button={<span>Open menu</span>}
                items={[{
                    name: 'Archive',
                    onClick: () => undefined
                }]}
            />
        );

        const trigger = screen.getByRole('button', { name: 'Open menu' });
        expect(trigger.className).toContain('focus-ring-soft');
        expect(trigger.className).toContain('rounded-[16px]');
        expect(trigger.className).not.toContain('shadow-sketchy');

        await user.click(trigger);

        const item = screen.getByRole('menuitem', { name: 'Archive' });
        const itemClasses = item.className.split(' ');
        expect(item.className).toContain('focus-ring-soft');
        expect(itemClasses).not.toContain('focus:bg-hover');
    });
});
