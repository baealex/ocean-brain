import { render, screen } from '@testing-library/react';

import { Checkbox } from './Checkbox';
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

    it('keeps the visual checkbox focus ring connected to the hidden input', () => {
        render(<Checkbox aria-label="Include metadata" />);

        const checkbox = screen.getByRole('checkbox', { name: 'Include metadata' });
        const visualCheckbox = checkbox.nextElementSibling;

        expect(visualCheckbox).toHaveClass('peer-focus-visible:border-border-focus');
        expect(visualCheckbox).toHaveClass(
            'peer-focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent-soft-primary)_90%,transparent)]',
        );
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
