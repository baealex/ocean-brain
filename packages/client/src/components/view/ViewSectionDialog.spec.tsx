import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { NotePropertyKeySummary } from '~/apis/note.api';
import type { Tag } from '~/models/tag.model';
import type { ViewSection } from '~/models/view.model';
import ViewSectionDialog from './ViewSectionDialog';

beforeAll(() => {
    Object.defineProperties(HTMLElement.prototype, {
        hasPointerCapture: { configurable: true, value: () => false },
        setPointerCapture: { configurable: true, value: () => undefined },
        releasePointerCapture: { configurable: true, value: () => undefined },
        scrollIntoView: { configurable: true, value: () => undefined },
    });
});

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
        tablePropertyKeys: [],
        boardGroupByPropertyKey: null,
        calendarDateField: 'createdAt',
        calendarDatePropertyKey: null,
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
    it('submits a board grouped by the selected property', async () => {
        const user = userEvent.setup();
        const handleSubmit = vi.fn();
        const statusProperty = createProperty({
            key: 'status',
            name: 'Status',
            valueType: 'select',
            options: [
                { id: 'todo', label: 'To do', value: 'todo', order: 0 },
                { id: 'doing', label: 'Doing', value: 'doing', order: 1 },
            ],
        });

        render(
            <ViewSectionDialog
                open
                mode="create"
                availableTags={[]}
                availableProperties={[statusProperty]}
                onClose={vi.fn()}
                onSubmit={handleSubmit}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Show as board' }));
        await user.click(screen.getByRole('button', { name: 'Create section' }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                displayType: 'board',
                displayOptions: expect.objectContaining({ boardGroupByPropertyKey: 'status' }),
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
                displayType: 'table',
                displayOptions: expect.objectContaining({
                    tableColumns: ['title', 'updatedAt'],
                }),
            }),
        );
    });

    it('submits selected shared properties as dedicated table columns', async () => {
        const user = userEvent.setup();
        const handleSubmit = vi.fn();
        const statusProperty = createProperty({
            key: 'status',
            name: 'Status',
            valueType: 'select',
            options: [{ id: 'doing', label: 'Doing', value: 'doing', order: 0 }],
        });

        render(
            <ViewSectionDialog
                open
                mode="create"
                availableTags={[]}
                availableProperties={[statusProperty]}
                onClose={vi.fn()}
                onSubmit={handleSubmit}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Show as table' }));
        await user.click(screen.getByRole('checkbox', { name: 'Show Status property column' }));
        await user.click(screen.getByRole('button', { name: 'Create section' }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                displayOptions: expect.objectContaining({ tablePropertyKeys: ['status'] }),
            }),
        );
    });

    it('submits a calendar section with the default note date field', async () => {
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

        await user.click(screen.getByRole('radio', { name: 'Show as calendar' }));
        expect(screen.getByRole('combobox', { name: 'Place notes by' })).toHaveTextContent('Created date');
        await user.click(screen.getByRole('button', { name: 'Create section' }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                displayType: 'calendar',
                displayOptions: expect.objectContaining({ calendarDateField: 'createdAt' }),
            }),
        );
    });

    it('uses a shared date property as the calendar placement field', async () => {
        const user = userEvent.setup();
        const handleSubmit = vi.fn();
        const dueDateProperty = createProperty({
            key: 'due-date',
            name: 'Due date',
            valueType: 'date',
        });

        render(
            <ViewSectionDialog
                open
                mode="create"
                availableTags={[]}
                availableProperties={[dueDateProperty]}
                onClose={vi.fn()}
                onSubmit={handleSubmit}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Show as calendar' }));
        await user.click(screen.getByRole('combobox', { name: 'Place notes by' }));
        await user.click(await screen.findByRole('option', { name: 'Due date · date property' }));
        await user.click(screen.getByRole('button', { name: 'Create section' }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                displayType: 'calendar',
                displayOptions: expect.objectContaining({
                    calendarDateField: 'property',
                    calendarDatePropertyKey: 'due-date',
                }),
            }),
        );
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

    it('exposes existing tag chip selection state', () => {
        render(
            <ViewSectionDialog
                open
                mode="edit"
                initialSection={createSection({ tagNames: ['@product'] })}
                availableTags={[createTag('@product', 1), createTag('@docs', 2)]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: '@product' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: '@docs' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('preserves calendar display settings when editing', () => {
        render(
            <ViewSectionDialog
                open
                mode="edit"
                initialSection={createSection({
                    displayType: 'calendar',
                    displayOptions: {
                        ...createSection().displayOptions,
                        calendarDateField: 'updatedAt',
                    },
                })}
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole('radio', { name: 'Show as calendar' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('combobox', { name: 'Place notes by' })).toHaveTextContent('Updated date');
        expect(screen.queryByRole('combobox', { name: 'Rows per page' })).not.toBeInTheDocument();
    });

    it('labels sort and limit selects through their visible labels', () => {
        render(
            <ViewSectionDialog
                open
                mode="edit"
                initialSection={createSection()}
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Order' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Rows per page' })).toBeInTheDocument();
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
