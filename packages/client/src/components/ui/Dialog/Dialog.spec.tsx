import { render, screen } from '@testing-library/react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from './Dialog';

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
