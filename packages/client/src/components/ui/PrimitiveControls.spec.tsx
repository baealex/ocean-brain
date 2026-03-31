import { render, screen } from '@testing-library/react';

import { Input } from './Input';
import { Select } from './Select';

describe('shared primitive controls', () => {
    it('keeps input-like controls on soft focus rings with restrained radii', () => {
        render(
            <>
                <Input placeholder="Search notes" />
                <Select placeholder="Sort by" />
            </>
        );

        const input = screen.getByPlaceholderText('Search notes');
        expect(input.className).toContain('focus-ring-soft');
        expect(input.className).toContain('rounded-[16px]');

        const trigger = screen.getByRole('combobox');
        expect(trigger.className).toContain('focus-ring-soft');
        expect(trigger.className).toContain('rounded-[16px]');
    });
});
