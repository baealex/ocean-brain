import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Note } from '~/models/note.model';
import type { ViewSection } from '~/models/view.model';
import ViewSectionRenderer from './ViewSectionRenderer';

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

vi.mock('./ViewSectionCalendarRenderer', () => ({
    default: ({ section }: { section: ViewSection }) => (
        <div aria-label="View query results as a calendar">{section.displayOptions.calendarDateField}</div>
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

const renderRenderer = (section: ViewSection, onEdit = vi.fn()) =>
    render(
        <ViewSectionRenderer
            section={section}
            notes={[createNote()]}
            isPending={false}
            isError={false}
            onRetry={vi.fn()}
            onEdit={onEdit}
            onSortChange={vi.fn()}
            isSortPending={false}
        />,
    );

describe('<ViewSectionRenderer />', () => {
    it('renders list sections with the list renderer', () => {
        renderRenderer(createSection({ displayType: 'list' }));

        expect(screen.getByRole('link', { name: /Ocean Brain task/i })).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Doing')).toBeInTheDocument();
        expect(screen.getByLabelText('Pinned')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders table sections with the table renderer', () => {
        renderRenderer(createSection({ displayType: 'table' }));

        expect(screen.getByRole('table', { name: 'View query results as a table' })).toBeInTheDocument();
    });

    it('renders calendar sections with the calendar renderer', () => {
        renderRenderer(createSection({ displayType: 'calendar' }));

        expect(screen.getByLabelText('View query results as a calendar')).toHaveTextContent('createdAt');
    });

    it('offers calendar recovery when its date property is unavailable', async () => {
        const user = userEvent.setup();
        const handleEdit = vi.fn();
        const section = createSection({
            displayType: 'calendar',
            displayOptions: {
                ...createSection().displayOptions,
                calendarDateField: 'property',
                calendarDatePropertyKey: 'due-date',
            },
        });

        renderRenderer(section, handleEdit);

        expect(screen.getByText('Calendar date property is unavailable')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Edit calendar' }));
        expect(handleEdit).toHaveBeenCalledOnce();
    });
});
