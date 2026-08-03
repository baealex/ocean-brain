import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Note } from '~/models/note.model';
import type { ViewSection } from '~/models/view.model';
import ViewSectionTableRenderer from './ViewSectionTableRenderer';

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

const createSection = (patch: Partial<ViewSection> = {}): ViewSection => ({
    id: 'section-1',
    tabId: 'tab-1',
    title: 'Ocean Brain tasks',
    displayType: 'table',
    displayOptions: {
        tableColumns: ['title', 'tags', 'properties', 'createdAt', 'updatedAt'],
        tablePropertyKeys: [],
        boardGroupByPropertyKey: null,
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

const renderTable = (props: Partial<React.ComponentProps<typeof ViewSectionTableRenderer>> = {}) =>
    render(
        <ViewSectionTableRenderer
            section={createSection()}
            notes={[createNote()]}
            isPending={false}
            isError={false}
            onRetry={vi.fn()}
            onSortChange={vi.fn()}
            isSortPending={false}
            {...props}
        />,
    );

describe('<ViewSectionTableRenderer />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
            section: createSection({
                displayOptions: {
                    tableColumns: ['title', 'tags', 'properties'],
                    tablePropertyKeys: ['status'],
                    boardGroupByPropertyKey: null,
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
            section: createSection({
                displayOptions: {
                    tableColumns: ['title', 'updatedAt'],
                    tablePropertyKeys: [],
                    boardGroupByPropertyKey: null,
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
