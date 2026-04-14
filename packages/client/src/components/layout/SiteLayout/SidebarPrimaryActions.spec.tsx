import { fireEvent, render, screen } from '@testing-library/react';

import SidebarPrimaryActions from './SidebarPrimaryActions';

const mockCreate = vi.fn();

vi.mock('~/hooks/resource/useNoteMutate', () => ({ default: () => ({ onCreate: mockCreate }) }));

vi.mock('./PinnedNotesPanel', () => ({
    default: () => <div data-testid="pinned-notes-panel">Pinned notes panel</div>,
}));

describe('<SidebarPrimaryActions />', () => {
    it('triggers note creation from the capture action and renders the pinned panel', () => {
        render(<SidebarPrimaryActions />);

        const captureButton = screen.getByRole('button', { name: /capture/i });

        expect(captureButton).toBeInTheDocument();
        expect(screen.getByTestId('pinned-notes-panel')).toBeInTheDocument();

        fireEvent.click(captureButton);

        expect(mockCreate).toHaveBeenCalled();
    });
});
