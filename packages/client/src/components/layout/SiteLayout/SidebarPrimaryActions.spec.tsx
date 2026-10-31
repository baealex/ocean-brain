import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SidebarPrimaryActions from './SidebarPrimaryActions';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mockNavigate }));

describe('<SidebarPrimaryActions />', () => {
    it('opens a new note without creating it yet', async () => {
        const user = userEvent.setup();

        render(<SidebarPrimaryActions />);

        await user.click(screen.getByRole('button', { name: /capture/i }));

        expect(mockNavigate).toHaveBeenCalledWith({ to: '/$id', params: { id: 'new' } });
    });
});
