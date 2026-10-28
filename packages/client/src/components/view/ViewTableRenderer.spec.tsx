import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { fetchNote, type NotePropertyKeySummary, updateNoteProperties } from '~/apis/note.api';

import type { Note } from '~/models/note.model';
import type { View } from '~/models/view.model';
import ViewTableColumnsEditor from './ViewTableColumnsEditor';
import ViewTableRenderer from './ViewTableRenderer';

vi.mock('~/apis/note.api', () => ({ fetchNote: vi.fn(), updateNoteProperties: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
    Link: ({
        children,
        params,
        to,
        ...props
    }: {
        children: React.ReactNode;
        params?: { id?: string };
        to?: string;
    }) => (
        <a href={params?.id ? `/${params.id}` : to} {...props}>
            {children}
        </a>
    ),
}));

const createNote = (patch: Partial<Note> = {}): Note => ({
    id: 'note-1',
    title: 'Ocean Brain task',
    content: '',
    pinned: false,
    order: 0,
    layout: 'wide',
    tags: [{ id: 'tag-1', name: '@제품' }],
    properties: [
        {
            key: 'status',
            name: 'Status',
            value: 'doing',
            valueType: 'select',
            option: {
                id: 'option-1',
                label: 'Doing',
                value: 'doing',
                order: 0,
            },
            createdAt: '1780000000000',
            updatedAt: '1780000000000',
        },
    ],
    createdAt: '1780000000000',
    updatedAt: '1780000000000',
    ...patch,
});

const createView = (patch: Partial<View> = {}): View => ({
    id: 'view-1',
    groupId: 'group-1',
    title: 'Ocean Brain tasks',
    displayType: 'table',
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

it('hides the last selected property column instead of restoring automatic columns', async () => {
    const user = userEvent.setup();
    const TableWithColumns = () => {
        const [options, setOptions] = useState({ ...createView().displayOptions, tablePropertyKeys: ['status'] });
        return (
            <>
                <ViewTableColumnsEditor
                    columns={options.tableColumns}
                    propertyKeys={options.tablePropertyKeys}
                    availableProperties={[]}
                    onColumnsChange={(tableColumns) => setOptions((current) => ({ ...current, tableColumns }))}
                    onPropertyKeysChange={(tablePropertyKeys) =>
                        setOptions((current) => ({ ...current, tablePropertyKeys }))
                    }
                />
                <ViewTableRenderer
                    view={createView({ displayOptions: options })}
                    notes={[createNote()]}
                    isPending={false}
                    isError={false}
                    onRetry={vi.fn()}
                    onSortChange={vi.fn()}
                    isSortPending={false}
                />
            </>
        );
    };
    render(<TableWithColumns />);
    expect(screen.getByRole('columnheader', { name: /Status/ })).toBeVisible();

    await user.click(screen.getByRole('checkbox', { name: 'Show status column' }));

    expect(screen.queryByRole('columnheader', { name: /Status/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ocean Brain task' })).toBeVisible();
});

const renderTable = (props: Partial<React.ComponentProps<typeof ViewTableRenderer>> = {}) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
            <ViewTableRenderer
                view={createView()}
                notes={[createNote()]}
                isPending={false}
                isError={false}
                onRetry={vi.fn()}
                onSortChange={vi.fn()}
                isSortPending={false}
                {...props}
            />
        </QueryClientProvider>,
    );

const priorityDefinition: NotePropertyKeySummary = {
    key: 'priority',
    name: 'Priority',
    valueType: 'number',
    noteCount: 1,
    options: [],
    updatedAt: '1780000000000',
};
const priorityNote = () =>
    createNote({
        id: '7',
        properties: [
            {
                key: 'priority',
                name: 'Priority',
                value: '2',
                valueType: 'number',
                createdAt: '1780000000000',
                updatedAt: '1780000000000',
            },
        ],
    });
const savedPriority = (value: string, version = '1780000001000') => ({
    id: '7',
    updatedAt: version,
    properties: [
        {
            key: 'priority',
            name: 'Priority',
            value,
            valueType: 'number' as const,
            createdAt: '1780000000000',
            updatedAt: version,
        },
    ],
});

describe('editing table properties', () => {
    beforeEach(() => vi.resetAllMocks());

    it('saves numeric zero without navigating away from the table', async () => {
        const user = userEvent.setup();
        vi.mocked(updateNoteProperties).mockResolvedValue({
            type: 'success',
            updateNoteProperties: savedPriority('0'),
        });
        renderTable({ notes: [priorityNote()], availableProperties: [priorityDefinition] });

        await user.click(screen.getByRole('button', { name: 'Edit Priority for Ocean Brain task' }));
        await user.clear(screen.getByRole('spinbutton', { name: 'Priority value' }));
        await user.type(screen.getByRole('spinbutton', { name: 'Priority value' }), '0');
        await user.keyboard('{Enter}');

        await waitFor(() =>
            expect(updateNoteProperties).toHaveBeenCalledWith({
                id: '7',
                expectedUpdatedAt: '1780000000000',
                set: [{ key: 'priority', valueType: 'number', value: '0' }],
            }),
        );
        expect(await screen.findByRole('button', { name: 'Edit Priority for Ocean Brain task' })).toHaveTextContent(
            '0',
        );
        expect(screen.getByRole('link', { name: 'Ocean Brain task' })).toHaveAttribute('href', '/7');
    });

    it('stores false as a boolean value rather than removing the property', async () => {
        const user = userEvent.setup();
        const definition = { ...priorityDefinition, key: 'done', name: 'Done', valueType: 'boolean' as const };
        const property = {
            ...savedPriority('true').properties[0],
            key: 'done',
            name: 'Done',
            valueType: 'boolean' as const,
        };
        const note = createNote({ id: '7', properties: [property] });
        vi.mocked(updateNoteProperties).mockResolvedValue({
            type: 'success',
            updateNoteProperties: {
                ...note,
                updatedAt: '1780000001000',
                properties: [{ ...property, value: 'false' }],
            },
        });
        renderTable({ notes: [note], availableProperties: [definition] });

        await user.click(screen.getByRole('button', { name: 'Edit Done for Ocean Brain task' }));
        await user.click(screen.getByRole('checkbox', { name: 'Done value' }));
        await user.click(screen.getByRole('button', { name: 'Save Done' }));

        await waitFor(() =>
            expect(updateNoteProperties).toHaveBeenCalledWith({
                id: '7',
                expectedUpdatedAt: note.updatedAt,
                set: [{ key: 'done', valueType: 'boolean', value: 'false' }],
            }),
        );
        expect(await screen.findByRole('button', { name: 'Edit Done for Ocean Brain task' })).toHaveTextContent(
            'False',
        );
    });

    it('clears only the selected property', async () => {
        const user = userEvent.setup();
        vi.mocked(updateNoteProperties).mockResolvedValue({
            type: 'success',
            updateNoteProperties: { id: '7', updatedAt: '1780000001000', properties: [] },
        });
        renderTable({ notes: [priorityNote()], availableProperties: [priorityDefinition] });

        await user.click(screen.getByRole('button', { name: 'Edit Priority for Ocean Brain task' }));
        await user.click(screen.getByRole('button', { name: 'Clear Priority' }));

        await waitFor(() =>
            expect(updateNoteProperties).toHaveBeenCalledWith({
                id: '7',
                expectedUpdatedAt: '1780000000000',
                deleteKeys: ['priority'],
            }),
        );
        expect(await screen.findByRole('button', { name: 'Edit Priority for Ocean Brain task' })).toHaveTextContent(
            '—',
        );
    });

    it('discards the draft on Escape and returns focus to the cell', async () => {
        const user = userEvent.setup();
        renderTable({ notes: [priorityNote()], availableProperties: [priorityDefinition] });
        await user.click(screen.getByRole('button', { name: 'Edit Priority for Ocean Brain task' }));
        await user.clear(screen.getByRole('spinbutton', { name: 'Priority value' }));
        await user.type(screen.getByRole('spinbutton', { name: 'Priority value' }), '3');

        await user.keyboard('{Escape}');

        const cell = screen.getByRole('button', { name: 'Edit Priority for Ocean Brain task' });
        expect(cell).toHaveTextContent('2');
        await waitFor(() => expect(cell).toHaveFocus());
        expect(updateNoteProperties).not.toHaveBeenCalled();
    });

    it('keeps a failed draft available for retry', async () => {
        const user = userEvent.setup();
        vi.mocked(updateNoteProperties)
            .mockResolvedValueOnce({
                type: 'error',
                category: 'network',
                errors: [{ code: 'NETWORK_ERROR', message: 'Connection interrupted.' }],
            })
            .mockResolvedValueOnce({ type: 'success', updateNoteProperties: savedPriority('3') });
        renderTable({ notes: [priorityNote()], availableProperties: [priorityDefinition] });
        await user.click(screen.getByRole('button', { name: 'Edit Priority for Ocean Brain task' }));
        await user.clear(screen.getByRole('spinbutton', { name: 'Priority value' }));
        await user.type(screen.getByRole('spinbutton', { name: 'Priority value' }), '3');

        await user.keyboard('{Enter}');

        expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted.');
        expect(screen.getByRole('spinbutton', { name: 'Priority value' })).toHaveValue(3);

        await user.click(screen.getByRole('button', { name: 'Save Priority' }));

        expect(await screen.findByRole('button', { name: 'Edit Priority for Ocean Brain task' })).toHaveTextContent(
            '3',
        );
        expect(updateNoteProperties).toHaveBeenCalledTimes(2);
    });

    it('renders property values without edit controls in a read-only table', () => {
        renderTable({ readOnly: true, notes: [priorityNote()], availableProperties: [priorityDefinition] });

        expect(screen.getByRole('cell', { name: '2' })).toBeVisible();
        expect(screen.queryByRole('button', { name: /Edit Priority/ })).not.toBeInTheDocument();
    });

    it('preserves a conflicting draft until the user reloads the saved value', async () => {
        const user = userEvent.setup();
        vi.mocked(updateNoteProperties).mockResolvedValueOnce({
            type: 'error',
            category: 'graphql',
            errors: [{ code: 'NOTE_UPDATE_CONFLICT', message: 'Note changed elsewhere.' }],
        });
        vi.mocked(fetchNote).mockResolvedValue({ type: 'success', note: { ...priorityNote(), ...savedPriority('4') } });
        renderTable({ notes: [priorityNote()], availableProperties: [priorityDefinition] });
        await user.click(screen.getByRole('button', { name: 'Edit Priority for Ocean Brain task' }));
        await user.clear(screen.getByRole('spinbutton', { name: 'Priority value' }));
        await user.type(screen.getByRole('spinbutton', { name: 'Priority value' }), '3');

        await user.keyboard('{Enter}');

        expect(await screen.findByRole('alert')).toHaveTextContent('Note changed elsewhere.');
        expect(screen.getByRole('spinbutton', { name: 'Priority value' })).toHaveValue(3);
        expect(screen.getByRole('button', { name: 'Save Priority' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Reload latest value' }));

        await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Priority value' })).toHaveValue(4));
        expect(screen.getByRole('button', { name: 'Save Priority' })).toBeEnabled();
    });
});

describe('<ViewTableRenderer />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the saved column order including a title column moved away from the start', () => {
        renderTable({
            view: createView({
                displayOptions: {
                    ...createView().displayOptions,
                    tableColumns: ['updatedAt', 'properties', 'title'],
                    tablePropertyKeys: ['priority', 'status'],
                },
            }),
            availableProperties: [
                { key: 'priority', name: 'Priority', valueType: 'number', noteCount: 0, options: [], updatedAt: '0' },
            ],
        });

        const headers = screen.getAllByRole('columnheader');

        expect(headers).toHaveLength(4);
        expect(headers[0]).toHaveAccessibleName(/Updated/);
        expect(headers[1]).toHaveAccessibleName(/Priority/);
        expect(headers[2]).toHaveAccessibleName(/Status/);
        expect(headers[3]).toHaveAccessibleName(/Title/);
        expect(screen.getByRole('link', { name: 'Ocean Brain task' })).toHaveAttribute('href', '/note-1');
    });

    it('renders note query results as table rows with tags and properties', () => {
        renderTable();

        const table = screen.getByRole('table', { name: 'View query results as a table' });

        expect(table).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: /Created/ })).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: /Updated/ })).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: /Status/ })).toBeInTheDocument();
        expect(within(table).queryByRole('columnheader', { name: 'Properties' })).not.toBeInTheDocument();
        expect(within(table).getByText('Ocean Brain task')).toBeInTheDocument();
        expect(within(table).getByText('@제품')).toBeInTheDocument();
        expect(within(table).getByText('Doing')).toBeInTheDocument();
    });

    it('keeps note navigation on the title link', () => {
        renderTable();

        const link = screen.getByRole('link', { name: /Ocean Brain task/i });
        const row = link.closest('tr');

        expect(row).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/note-1');
        expect(within(row!).getAllByRole('link')).toHaveLength(1);
    });

    it('keeps notes without tags or properties visible with empty table cells', () => {
        renderTable({
            notes: [createNote({ tags: [], properties: [] })],
            view: createView({
                displayOptions: {
                    tableColumns: ['title', 'tags', 'properties'],
                    tablePropertyKeys: ['status'],
                    boardGroupByPropertyKey: null,
                    calendarDateField: 'createdAt',
                    calendarDatePropertyKey: null,
                },
            }),
            availableProperties: [
                {
                    key: 'status',
                    name: 'Status',
                    valueType: 'select',
                    noteCount: 1,
                    options: [],
                    updatedAt: '1780000000000',
                },
            ],
        });

        expect(screen.getByText('Ocean Brain task')).toBeInTheDocument();
        expect(screen.getAllByText('—')).toHaveLength(2);
    });

    it('respects selected table columns', () => {
        renderTable({
            view: createView({
                displayOptions: {
                    tableColumns: ['title', 'updatedAt'],
                    tablePropertyKeys: [],
                    boardGroupByPropertyKey: null,
                    calendarDateField: 'createdAt',
                    calendarDatePropertyKey: null,
                },
            }),
        });

        const table = screen.getByRole('table', { name: 'View query results as a table' });

        expect(within(table).getByRole('columnheader', { name: /Title/ })).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: /Updated/ })).toBeInTheDocument();
        expect(within(table).queryByRole('columnheader', { name: 'Tags' })).not.toBeInTheDocument();
        expect(within(table).queryByRole('columnheader', { name: 'Properties' })).not.toBeInTheDocument();
    });

    it('requests sorting from sortable column headers', async () => {
        const user = userEvent.setup();
        const handleSortChange = vi.fn();

        renderTable({ onSortChange: handleSortChange });

        await user.click(screen.getByRole('button', { name: /Title/ }));

        expect(handleSortChange).toHaveBeenCalledWith('title');
    });
});
