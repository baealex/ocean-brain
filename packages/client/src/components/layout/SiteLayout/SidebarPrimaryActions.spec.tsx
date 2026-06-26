import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SidebarPrimaryActions from './SidebarPrimaryActions';

const mockCreate = vi.fn();

vi.mock('~/hooks/resource/useNoteMutate', () => ({ default: () => ({ onCreate: mockCreate }) }));

vi.mock('./PinnedNotesPanel', () => ({
    default: () => <div data-testid="pinned-notes-panel">Pinned notes panel</div>,
}));

describe('<SidebarPrimaryActions />', () => {
    it('triggers note creation from the capture action', async () => {
        const user = userEvent.setup();

        render(<SidebarPrimaryActions />);

        const captureButton = screen.getByRole('button', { name: /capture/i });

        expect(captureButton).toBeInTheDocument();

        await user.click(captureButton);

        expect(mockCreate).toHaveBeenCalled();
    });

    it('renders the pinned notes panel', () => {
        render(<SidebarPrimaryActions />);

        expect(screen.getByTestId('pinned-notes-panel')).toBeInTheDocument();
    });
});
