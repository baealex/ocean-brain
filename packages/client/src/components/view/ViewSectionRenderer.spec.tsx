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

const createNote = (): Note => ({
    id: 'note-1',
    title: 'Ocean Brain task',
    content: '',
    pinned: false,
    order: 0,
    layout: 'wide',
    tags: [{ id: 'tag-1', name: '@제품' }],
    properties: [],
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
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders table sections with the table renderer', () => {
        renderRenderer(createSection({ displayType: 'table' }));

        expect(screen.getByRole('table', { name: 'View query results as a table' })).toBeInTheDocument();
    });

    it('shows a generic unavailable state for unsupported display types', () => {
        renderRenderer(createSection({ displayType: 'calendar' }));

        expect(screen.getByText('This display type is unavailable')).toBeInTheDocument();
        expect(
            screen.getByText('Switch this section to List or Table to preview the saved query here.'),
        ).toBeInTheDocument();
    });

    it('opens editing from the unsupported display type recovery action', async () => {
        const handleEdit = vi.fn();
        const user = userEvent.setup();

        renderRenderer(createSection({ displayType: 'calendar' }), handleEdit);

        await user.click(screen.getByRole('button', { name: 'Change display' }));

        expect(handleEdit).toHaveBeenCalledTimes(1);
    });
});
