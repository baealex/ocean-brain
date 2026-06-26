import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { NotePropertyKeySummary } from '~/apis/note.api';
import type { Tag } from '~/models/tag.model';
import type { ViewSection } from '~/models/view.model';
import ViewSectionDialog from './ViewSectionDialog';

const createTag = (name: string, index: number): Pick<Tag, 'id' | 'name'> => ({
    id: `tag-${index}`,
    name,
});

const createProperty = (patch: Partial<NotePropertyKeySummary> = {}): NotePropertyKeySummary => ({
    key: 'source',
    name: 'Source',
    valueType: 'url',
    noteCount: 0,
    options: [],
    updatedAt: '2026-06-03T00:00:00.000Z',
    ...patch,
});

const createSection = (patch: Partial<ViewSection> = {}): ViewSection => ({
    id: 'section-1',
    tabId: 'tab-1',
    title: 'Ocean Brain tasks',
    displayType: 'list',
    displayOptions: {
        tableColumns: ['title', 'tags', 'properties', 'createdAt', 'updatedAt'],
    },
    tagNames: [],
    mode: 'and',
    propertyFilters: [],
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 5,
    order: 0,
    ...patch,
});

describe('<ViewSectionDialog />', () => {
    it('submits the selected table display type', async () => {
        const user = userEvent.setup();
        const handleSubmit = vi.fn();

        render(
            <ViewSectionDialog
                open
                mode="create"
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={handleSubmit}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Show as table' }));
        await user.click(screen.getByRole('button', { name: 'Create section' }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                displayType: 'table',
            }),
        );
    });

    it('submits selected table columns with title kept visible', async () => {
        const user = userEvent.setup();
        const handleSubmit = vi.fn();

        render(
            <ViewSectionDialog
                open
                mode="create"
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={handleSubmit}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Show as table' }));
        await user.click(screen.getByRole('checkbox', { name: 'Show Tags column' }));
        await user.click(screen.getByRole('checkbox', { name: 'Show Properties column' }));
        await user.click(screen.getByRole('checkbox', { name: 'Show Created column' }));
        await user.click(screen.getByRole('button', { name: 'Create section' }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                displayOptions: {
                    tableColumns: ['title', 'updatedAt'],
                },
            }),
        );
    });

    it('does not expose unavailable calendar display options', () => {
        render(
            <ViewSectionDialog
                open
                mode="create"
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.queryByText(/Calendar/i)).not.toBeInTheDocument();
    });

    it('labels tag match choices as AND and OR with helper text', () => {
        render(
            <ViewSectionDialog
                open
                mode="edit"
                initialSection={createSection({ tagNames: ['@product', '@docs'] })}
                availableTags={[createTag('@product', 1), createTag('@docs', 2)]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByText('Tag match')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'AND — all selected tags' })).toHaveTextContent('AND');
        expect(screen.getByRole('radio', { name: 'OR — any selected tag' })).toHaveTextContent('OR');
        expect(screen.getByText('AND requires every selected tag. OR accepts any selected tag.')).toBeInTheDocument();
    });

    it('normalizes unavailable initial display types back to list when editing', () => {
        render(
            <ViewSectionDialog
                open
                mode="edit"
                initialSection={createSection({ displayType: 'calendar' })}
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole('radio', { name: 'Show as list' })).toHaveAttribute('aria-checked', 'true');
    });

    it('submits partial URL text for contains filters', async () => {
        const user = userEvent.setup();
        const handleSubmit = vi.fn();

        render(
            <ViewSectionDialog
                open
                mode="edit"
                initialSection={createSection({
                    propertyFilters: [
                        {
                            key: 'source',
                            name: 'Source',
                            valueType: 'url',
                            operator: 'contains',
                            value: '',
                        },
                    ],
                })}
                availableTags={[]}
                availableProperties={[createProperty()]}
                onClose={vi.fn()}
                onSubmit={handleSubmit}
            />,
        );

        const valueInput = screen.getByLabelText('Property filter value');

        expect(valueInput).toHaveAttribute('type', 'text');

        await user.type(valueInput, 'example.com');
        await user.click(screen.getByRole('button', { name: 'Save section' }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                propertyFilters: [
                    {
                        key: 'source',
                        operator: 'contains',
                        value: 'example.com',
                        valueType: 'url',
                    },
                ],
            }),
        );
    });
});
