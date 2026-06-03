import { fireEvent, render, screen, within } from '@testing-library/react';

import type { Note } from '~/models/note.model';
import type { ViewSection } from '~/models/view.model';
import { NOTE_ROUTE } from '~/modules/url';
import ViewSectionTableRenderer from './ViewSectionTableRenderer';

const mockNavigate = vi.fn();

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
    useNavigate: () => mockNavigate,
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
        expect(within(table).getByText('Ocean Brain task')).toBeInTheDocument();
        expect(within(table).getByText('@제품')).toBeInTheDocument();
        expect(within(table).getByText('Status')).toBeInTheDocument();
        expect(within(table).getByText('Doing')).toBeInTheDocument();
    });

    it('opens the note when a table row is activated', () => {
        renderTable();

        const row = screen.getByRole('link', { name: /Ocean Brain task/i }).closest('tr');

        expect(row).toBeInTheDocument();
        fireEvent.click(row);

        expect(mockNavigate).toHaveBeenCalledWith({
            to: NOTE_ROUTE,
            params: { id: 'note-1' },
        });
    });

    it('keeps notes without tags or properties visible with empty table cells', () => {
        renderTable({ notes: [createNote({ tags: [], properties: [] })] });

        expect(screen.getByText('Ocean Brain task')).toBeInTheDocument();
        expect(screen.getAllByText('—')).toHaveLength(2);
    });

    it('respects selected table columns', () => {
        renderTable({
            section: createSection({
                displayOptions: {
                    tableColumns: ['title', 'updatedAt'],
                },
            }),
        });

        const table = screen.getByRole('table', { name: 'View query results as a table' });

        expect(within(table).getByRole('columnheader', { name: /Title/ })).toBeInTheDocument();
        expect(within(table).getByRole('columnheader', { name: /Updated/ })).toBeInTheDocument();
        expect(within(table).queryByRole('columnheader', { name: 'Tags' })).not.toBeInTheDocument();
        expect(within(table).queryByRole('columnheader', { name: 'Properties' })).not.toBeInTheDocument();
    });

    it('requests saved section sorting from sortable column headers', () => {
        const handleSortChange = vi.fn();

        renderTable({ onSortChange: handleSortChange });

        fireEvent.click(screen.getByRole('button', { name: /Title/ }));

        expect(handleSortChange).toHaveBeenCalledWith('title');
    });
});
