import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Note } from '~/models/note.model';
import type { View } from '~/models/view.model';
import ViewRenderer from './ViewRenderer';

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
    useNavigate: () => vi.fn(),
}));

vi.mock('./ViewCalendarRenderer', () => ({
    default: ({ view }: { view: View }) => (
        <div aria-label="View query results as a calendar">{view.displayOptions.calendarDateField}</div>
    ),
}));

const createNote = (): Note => ({
    id: 'note-1',
    title: 'Ocean Brain task',
    content: '',
    pinned: true,
    order: 0,
    layout: 'wide',
    tags: [{ id: 'tag-1', name: '@제품' }],
    properties: [
        {
            key: 'status',
            name: 'Status',
            value: 'doing',
            valueType: 'select',
            option: { id: 'doing', label: 'Doing', value: 'doing', color: '#38bdf8', order: 0 },
            createdAt: '1780000000000',
            updatedAt: '1780000000000',
        },
    ],
    createdAt: '1780000000000',
    updatedAt: '1780000000000',
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

const renderRenderer = (view: View, onEdit = vi.fn()) =>
    render(
        <ViewRenderer
            view={view}
            notes={[createNote()]}
            isPending={false}
            isError={false}
            onRetry={vi.fn()}
            onEdit={onEdit}
            onSortChange={vi.fn()}
            isSortPending={false}
        />,
    );

describe('<ViewRenderer />', () => {
    it('renders list views with the list renderer', () => {
        renderRenderer(createView({ displayType: 'list' }));

        expect(screen.getByRole('link', { name: /Ocean Brain task/i })).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Doing')).toBeInTheDocument();
        expect(screen.getByLabelText('Pinned')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders table views with the table renderer', () => {
        renderRenderer(createView({ displayType: 'table' }));

        expect(screen.getByRole('table', { name: 'View query results as a table' })).toBeInTheDocument();
    });

    it('renders calendar views with the calendar renderer', () => {
        renderRenderer(createView({ displayType: 'calendar' }));

        expect(screen.getByLabelText('View query results as a calendar')).toHaveTextContent('createdAt');
    });

    it('offers calendar recovery when its date property is unavailable', async () => {
        const user = userEvent.setup();
        const handleEdit = vi.fn();
        const view = createView({
            displayType: 'calendar',
            displayOptions: {
                ...createView().displayOptions,
                calendarDateField: 'property',
                calendarDatePropertyKey: 'due-date',
            },
        });

        renderRenderer(view, handleEdit);

        expect(screen.getByText('Calendar date property is unavailable')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Edit calendar' }));
        expect(handleEdit).toHaveBeenCalledOnce();
    });
});
