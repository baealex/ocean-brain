import { render, screen } from '@testing-library/react';

import { Input } from './Input';
import { Select } from './Select';
import { ToggleGroup, ToggleGroupItem } from './ToggleGroup';

describe('shared primitive controls', () => {
    it('renders input-like controls with their expected accessible entry points', () => {
        render(
            <>
                <Input placeholder="Search notes" />
                <Select placeholder="Sort by" />
            </>,
        );

        expect(screen.getByPlaceholderText('Search notes')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('marks the selected toggle item through accessible radio state', () => {
        render(
            <ToggleGroup type="single" variant="pills" value="create">
                <ToggleGroupItem value="create">Create date</ToggleGroupItem>
                <ToggleGroupItem value="update">Update date</ToggleGroupItem>
            </ToggleGroup>,
        );

        const group = screen.getByRole('group');
        const activeItem = screen.getByRole('radio', { name: 'Create date' });
        const inactiveItem = screen.getByRole('radio', { name: 'Update date' });

        expect(group).toBeInTheDocument();
        expect(activeItem).toHaveAttribute('aria-checked', 'true');
        expect(inactiveItem).toHaveAttribute('aria-checked', 'false');
    });
});
