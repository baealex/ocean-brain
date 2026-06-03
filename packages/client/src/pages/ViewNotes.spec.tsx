import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Note } from '~/models/note.model';
import type { ViewSection } from '~/models/view.model';
import { createTestQueryClient } from '~/test/test-utils';
import ViewNotes from './ViewNotes';

const routeState = vi.hoisted(() => ({
    navigate: vi.fn(),
    search: {
        page: 1,
        sectionId: 'section-1',
    },
}));

const apiMocks = vi.hoisted(() => ({
    fetchViewSection: vi.fn(),
    fetchViewSectionNotes: vi.fn(),
    updateViewSection: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    getRouteApi: () => ({
        useNavigate: () => routeState.navigate,
        useSearch: () => routeState.search,
    }),
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
    useNavigate: () => routeState.navigate,
    useRouter: () => ({
        history: {
            back: vi.fn(),
        },
    }),
}));

vi.mock('~/apis/view.api', () => apiMocks);

vi.mock('~/hooks/resource/useNoteMutate', () => ({
    default: () => ({
        onDelete: vi.fn(),
        onPinned: vi.fn(),
        deleteWarningDialog: null,
    }),
}));

const createNote = (): Note => ({
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
});

const createSection = (patch: Partial<ViewSection> = {}): ViewSection => ({
    id: 'section-1',
    tabId: 'tab-1',
    title: 'Ocean Brain tasks',
    displayType: 'table',
    displayOptions: {
        tableColumns: ['title', 'tags', 'properties', 'updatedAt'],
    },
    tagNames: [],
    mode: 'and',
    propertyFilters: [
        {
            key: 'project',
            name: 'Project',
            valueType: 'select',
            operator: 'equals',
            value: 'ocean-brain',
        },
        {
            key: 'status',
            name: 'Status',
            valueType: 'select',
            operator: 'equals',
            value: 'doing',
        },
    ],
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 5,
    order: 0,
    ...patch,
});

const renderViewNotes = () => {
    const queryClient = createTestQueryClient();

    return render(
        <QueryClientProvider client={queryClient}>
            <ViewNotes />
        </QueryClientProvider>,
    );
};

describe('<ViewNotes />', () => {
    beforeEach(() => {
        routeState.search = {
            page: 1,
            sectionId: 'section-1',
        };

        apiMocks.fetchViewSection.mockResolvedValue({
            type: 'success',
            viewSection: createSection(),
        });
        apiMocks.fetchViewSectionNotes.mockResolvedValue({
            type: 'success',
            viewSectionNotes: {
                totalCount: 1,
                notes: [createNote()],
            },
        });
        apiMocks.updateViewSection.mockResolvedValue({
            type: 'success',
            updateViewSection: {
                id: 'section-1',
            },
        });
    });

    it('keeps a table section rendered as a table on the full results page', async () => {
        renderViewNotes();

        expect(await screen.findByRole('table', { name: 'View query results as a table' })).toBeInTheDocument();
        expect(screen.getByText('Project is ocean-brain')).toBeInTheDocument();
        expect(screen.getByText('Status is doing')).toBeInTheDocument();

        expect(apiMocks.fetchViewSectionNotes).toHaveBeenCalledWith('section-1', {
            limit: 25,
            offset: 0,
        });
    });

    it('saves full-result table sorting without dropping filters or display options', async () => {
        renderViewNotes();

        fireEvent.click(await screen.findByRole('button', { name: /Title/ }));

        await waitFor(() => {
            expect(apiMocks.updateViewSection).toHaveBeenCalledWith(
                'section-1',
                expect.objectContaining({
                    displayType: 'table',
                    displayOptions: {
                        tableColumns: ['title', 'tags', 'properties', 'updatedAt'],
                    },
                    propertyFilters: [
                        {
                            key: 'project',
                            valueType: 'select',
                            operator: 'equals',
                            value: 'ocean-brain',
                        },
                        {
                            key: 'status',
                            valueType: 'select',
                            operator: 'equals',
                            value: 'doing',
                        },
                    ],
                    sortBy: 'title',
                    sortOrder: 'asc',
                }),
            );
        });

        await waitFor(() => {
            expect(apiMocks.fetchViewSection).toHaveBeenCalledTimes(2);
            expect(apiMocks.fetchViewSectionNotes).toHaveBeenCalledTimes(2);
        });
    });
});
