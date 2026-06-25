import { fireEvent, render, screen } from '@testing-library/react';

import SidebarPrimaryActions from './SidebarPrimaryActions';

const mockCreate = vi.fn();

vi.mock('~/hooks/resource/useNoteMutate', () => ({ default: () => ({ onCreate: mockCreate }) }));

describe('<SidebarPrimaryActions />', () => {
    it('triggers note creation from the capture action', () => {
        render(<SidebarPrimaryActions />);

        const captureButton = screen.getByRole('button', { name: /capture/i });

        expect(captureButton).toBeInTheDocument();

        fireEvent.click(captureButton);

        expect(mockCreate).toHaveBeenCalled();
    });
});
