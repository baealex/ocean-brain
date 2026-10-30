import { render, screen } from '@testing-library/react';

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
});
