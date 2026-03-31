import { fireEvent, render, screen } from '@testing-library/react';

import SidebarPrimaryActions from './SidebarPrimaryActions';

const mockCreate = vi.fn();

vi.mock('~/hooks/resource/useNoteMutate', () => ({ default: () => ({ onCreate: mockCreate }) }));

vi.mock('./PinnedNotesPanel', () => ({ default: () => <div data-testid="pinned-notes-panel">Pinned notes panel</div> }));

describe('<SidebarPrimaryActions />', () => {
    it('renders the emphasized capture action and editorial pinned section', () => {
        render(<SidebarPrimaryActions />);

        const captureButton = screen.getByRole('button', { name: /capture note/i });

        expect(captureButton.className).toContain('bg-accent-secondary');
        expect(screen.getByText('Pinned')).toBeInTheDocument();
        expect(screen.getByText('Deliberately kept close for repeat reference.')).toBeInTheDocument();
        expect(screen.getByTestId('pinned-notes-panel')).toBeInTheDocument();

        fireEvent.click(captureButton);

        expect(mockCreate).toHaveBeenCalled();
    });
});
