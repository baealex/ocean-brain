import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NoteFilters from './NoteFilters';

const renderFilters = () =>
    render(
        <NoteFilters
            itemsPerPage={28}
            onItemsPerPageChange={vi.fn()}
            sortBy="updatedAt"
            onSortByChange={vi.fn()}
            sortOrder="desc"
            onSortOrderChange={vi.fn()}
            pinnedFirst={false}
            onPinnedFirstChange={vi.fn()}
        />,
    );

describe('<NoteFilters />', () => {
    it('presents the list size as a page size instead of a note count', () => {
        renderFilters();

        expect(screen.getByRole('combobox', { name: 'Per page' })).toHaveTextContent(/^28$/);
    });

    it('starts with the settings collapsed behind one control', () => {
        renderFilters();

        expect(screen.getByRole('button', { name: 'Display settings' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('expands the settings when the display settings control is pressed', async () => {
        const user = userEvent.setup();
        renderFilters();

        await user.click(screen.getByRole('button', { name: 'Display settings' }));

        expect(screen.getByRole('button', { name: 'Display settings' })).toHaveAttribute('aria-expanded', 'true');
    });
});
