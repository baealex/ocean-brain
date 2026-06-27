import { render, screen } from '@testing-library/react';

import { Select } from './Select';

describe('<Select />', () => {
    it('passes label and description props to the select trigger', () => {
        render(
            <>
                <span id="sort-label">Sort by</span>
                <span id="sort-description">Choose how notes are ordered</span>
                <Select
                    id="sort-select"
                    aria-labelledby="sort-label"
                    aria-describedby="sort-description"
                    placeholder="Sort by"
                />
            </>,
        );

        const trigger = screen.getByRole('combobox', { name: 'Sort by' });

        expect(trigger).toHaveAttribute('id', 'sort-select');
        expect(trigger).toHaveAccessibleDescription('Choose how notes are ordered');
    });
});
