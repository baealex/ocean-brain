import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fetchNote, fetchNotes, type NotePropertyKeySummary } from '~/apis/note.api';
import type { Tag } from '~/models/tag.model';
import type { View } from '~/models/view.model';
import { createQueryClientWrapper } from '~/test/test-utils';
import ViewDialog from './ViewDialog';

vi.mock('~/apis/note.api', () => ({ fetchNote: vi.fn(), fetchNotes: vi.fn() }));

const templateNote = {
    title: 'Meeting outline',
    content: '[]',
    layout: 'wide' as const,
    pinned: false,
    properties: [],
    createdAt: '2026-10-27',
    updatedAt: '2026-10-27',
};

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

const createView = (patch: Partial<View> = {}): View => ({
    id: 'view-1',
    groupId: 'group-1',
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

describe('<ViewDialog />', () => {
    it('selects an existing note as the saved view default template', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        vi.mocked(fetchNotes).mockResolvedValue({
            type: 'success',
            allNotes: { totalCount: 1, notes: [{ ...templateNote, id: '42', tags: [], order: 0 }] },
        });
        vi.mocked(fetchNote).mockResolvedValue({ type: 'success', note: templateNote });
        render(
            <ViewDialog
                open
                mode="edit"
                initialView={createView()}
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
            { wrapper: createQueryClientWrapper().Wrapper },
        );

        await user.click(screen.getByRole('button', { name: 'Choose template' }));
        await user.type(await screen.findByLabelText('Search template notes'), 'outline');
        await user.click(await screen.findByRole('button', { name: 'Meeting outline', exact: true }));
        await user.click(screen.getByRole('button', { name: 'Save view' }));

        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ defaultTemplateNoteId: '42' }));
    });

    it('allows clearing an unavailable template without changing the view filters', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        vi.mocked(fetchNote).mockResolvedValue({ type: 'error', errors: [{ message: 'Note not found' }] });
        render(
            <ViewDialog
                open
                mode="edit"
                initialView={createView({ defaultTemplateNoteId: '42', tagNames: ['@project-a'] })}
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
            { wrapper: createQueryClientWrapper().Wrapper },
        );

        await user.click(screen.getByRole('button', { name: 'Clear template' }));
        await user.click(screen.getByRole('button', { name: 'Save view' }));

        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ defaultTemplateNoteId: null, tagNames: ['@project-a'] }),
        );
    });

    it('saves the chosen table column order while keeping title visible', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(
            <ViewDialog
                open
                mode="edit"
                initialView={createView({ displayType: 'table' })}
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        await user.click(screen.getByText('Table columns', { selector: 'summary' }));
        await user.click(screen.getByRole('button', { name: 'Actions for Tags column' }));
        await user.click(screen.getByRole('menuitem', { name: 'Move up' }));
        await user.click(screen.getByRole('button', { name: 'Save view' }));

        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                displayOptions: expect.objectContaining({
                    tableColumns: ['tags', 'title', 'properties', 'createdAt', 'updatedAt'],
                }),
            }),
        );
        expect(screen.getByRole('checkbox', { name: 'Show Title column' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Show Title column' })).toBeDisabled();
    });

    it('saves the order of selected property columns', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(
            <ViewDialog
                open
                mode="edit"
                initialView={createView({
                    displayType: 'table',
                    displayOptions: { ...createView().displayOptions, tablePropertyKeys: ['source', 'priority'] },
                })}
                availableTags={[]}
                availableProperties={[
                    createProperty(),
                    createProperty({ key: 'priority', name: 'Priority', valueType: 'number' }),
                ]}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        await user.click(screen.getByText('Table columns', { selector: 'summary' }));
        await user.click(screen.getByRole('button', { name: 'Actions for Priority column' }));
        await user.click(screen.getByRole('menuitem', { name: 'Move up' }));
        await user.click(screen.getByRole('button', { name: 'Save view' }));

        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                displayOptions: expect.objectContaining({ tablePropertyKeys: ['priority', 'source'] }),
            }),
        );
    });

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
            <ViewDialog
                open
                mode="create"
                availableTags={[]}
                availableProperties={[statusProperty]}
                onClose={vi.fn()}
                onSubmit={handleSubmit}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Show as board' }));
        await user.click(screen.getByRole('button', { name: 'Create view' }));

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
            <ViewDialog
                open
                mode="create"
                availableTags={[]}
                availableProperties={[]}
                onClose={vi.fn()}
                onSubmit={handleSubmit}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Show as table' }));
        await user.click(screen.getByText('Table columns', { selector: 'summary' }));
        await user.click(screen.getByRole('checkbox', { name: 'Show Tags column' }));
        await user.click(screen.getByRole('checkbox', { name: 'Show Properties column' }));
        await user.click(screen.getByRole('checkbox', { name: 'Show Created column' }));
        await user.click(screen.getByRole('button', { name: 'Create view' }));

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
            <ViewDialog
                open
                mode="create"
                availableTags={[]}
                availableProperties={[statusProperty]}
                onClose={vi.fn()}
                onSubmit={handleSubmit}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Show as table' }));
        await user.click(screen.getByText('Table columns', { selector: 'summary' }));
        await user.click(screen.getByRole('radio', { name: 'Choose columns' }));
        await user.click(screen.getByRole('button', { name: 'Create view' }));

        expect(handleSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                displayOptions: expect.objectContaining({ tablePropertyKeys: ['status'] }),
            }),
        );
    });

    it('submits a calendar view with the default note date field', async () => {
        const user = userEvent.setup();
        const handleSubmit = vi.fn();

        render(
            <ViewDialog
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
        await user.click(screen.getByRole('button', { name: 'Create view' }));

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
            <ViewDialog
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
        await user.click(screen.getByRole('button', { name: 'Create view' }));

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
            <ViewDialog
                open
                mode="edit"
                initialView={createView({ tagNames: ['@product', '@docs'] })}
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
            <ViewDialog
                open
                mode="edit"
                initialView={createView({ tagNames: ['@product'] })}
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
            <ViewDialog
                open
                mode="edit"
                initialView={createView({
                    displayType: 'calendar',
                    displayOptions: {
                        ...createView().displayOptions,
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
            <ViewDialog
                open
                mode="edit"
                initialView={createView()}
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
            <ViewDialog
                open
                mode="edit"
                initialView={createView({
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
        await user.click(screen.getByRole('button', { name: 'Save view' }));

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
