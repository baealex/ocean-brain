import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { fetchAllNotePropertyKeys } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import {
    fetchViewSectionCalendarNotes,
    fetchViewSectionNotes,
    fetchViewWorkspace,
    reorderViewSections,
    reorderViewTabs,
} from '~/apis/view.api';
import { ConfirmProvider, ToastProvider } from '~/components/ui';
import type { ViewSection } from '~/models/view.model';
import { createQueryClientWrapper } from '~/test/test-utils';

import Views from './Views';

const routerMocks = vi.hoisted(() => ({
    search: {} as Record<string, unknown>,
    navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
    getRouteApi: () => ({
        useSearch: () => routerMocks.search,
        useNavigate: () => routerMocks.navigate,
    }),
}));

vi.mock('~/apis/note.api', () => ({ fetchAllNotePropertyKeys: vi.fn() }));
vi.mock('~/apis/tag.api', () => ({ fetchTags: vi.fn() }));
vi.mock('~/apis/view.api', () => ({
    createViewSection: vi.fn(),
    createViewTab: vi.fn(),
    deleteViewSection: vi.fn(),
    deleteViewTab: vi.fn(),
    fetchViewSectionCalendarNotes: vi.fn(),
    fetchViewWorkspace: vi.fn(),
    fetchViewSectionNotes: vi.fn(),
    reorderViewSections: vi.fn(),
    reorderViewTabs: vi.fn(),
    setActiveViewTab: vi.fn(),
    updateViewSection: vi.fn(),
    updateViewTab: vi.fn(),
}));

const createSection = (patch: Partial<ViewSection> = {}): ViewSection => ({
    id: 'section-1',
    tabId: 'tab-1',
    title: 'First section',
    displayType: 'list',
    displayOptions: {
        tableColumns: ['title'],
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

const mockActiveWorkspace = (sections: ViewSection[]) => {
    vi.mocked(fetchViewWorkspace).mockResolvedValue({
        type: 'success',
        viewWorkspace: {
            activeTabId: 'tab-1',
            tabs: [
                {
                    id: 'tab-1',
                    title: 'Work',
                    order: 0,
                    sections,
                },
                {
                    id: 'tab-2',
                    title: 'Later',
                    order: 1,
                    sections: [],
                },
            ],
        },
    } as never);
    vi.mocked(fetchViewSectionNotes).mockResolvedValue({
        type: 'success',
        viewSectionNotes: { totalCount: 0, notes: [] },
    } as never);
};

const renderViews = () => {
    const { Wrapper: QueryWrapper } = createQueryClientWrapper();
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryWrapper>
            <ToastProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
        </QueryWrapper>
    );

    return render(<Views />, { wrapper: Wrapper });
};

describe('<Views />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        routerMocks.search = {};
        routerMocks.navigate.mockResolvedValue(undefined);
        vi.mocked(fetchAllNotePropertyKeys).mockResolvedValue({
            type: 'success',
            notePropertyKeys: {
                totalCount: 0,
                keys: [],
            },
        } as never);
        vi.mocked(fetchTags).mockResolvedValue({
            type: 'success',
            allTags: {
                totalCount: 0,
                tags: [],
            },
        } as never);
        vi.mocked(fetchViewWorkspace).mockResolvedValue({
            type: 'success',
            viewWorkspace: {
                activeTabId: null,
                tabs: [],
            },
        } as never);
        vi.mocked(fetchViewSectionCalendarNotes).mockResolvedValue({
            type: 'success',
            viewSectionCalendarNotes: [],
        } as never);
    });

    it('renders the first-tab onboarding when there are no saved views', async () => {
        renderViews();

        expect(await screen.findByText('Create your first view tab')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create first tab' })).toBeInTheDocument();
    });

    it('restores and updates a table sort through the per-section URL state', async () => {
        const user = userEvent.setup();
        routerMocks.search = {
            tab: 'tab-1',
            state: {
                version: 1,
                sections: {
                    'section-1': { page: 2, sort: { by: 'title', order: 'asc' } },
                    'section-2': { page: 3 },
                },
            },
        };
        mockActiveWorkspace([
            createSection({ displayType: 'table' }),
            createSection({ id: 'section-2', title: 'Second section', order: 1 }),
        ]);
        vi.mocked(fetchViewSectionNotes).mockResolvedValue({
            type: 'success',
            viewSectionNotes: {
                totalCount: 20,
                notes: [
                    {
                        id: 'note-1',
                        title: 'Ocean Brain task',
                        content: '',
                        pinned: false,
                        order: 0,
                        layout: 'wide',
                        tags: [],
                        properties: [],
                        createdAt: '1780000000000',
                        updatedAt: '1780000000000',
                    },
                ],
            },
        } as never);

        renderViews();

        await screen.findAllByRole('button', { name: 'Section actions' });

        expect(fetchViewSectionNotes).toHaveBeenCalledWith('section-1', {
            limit: 5,
            offset: 5,
            sortBy: 'title',
            sortOrder: 'asc',
        });
        expect(fetchViewSectionNotes).toHaveBeenCalledWith('section-2', {
            limit: 5,
            offset: 10,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });

        await user.click(await screen.findByRole('button', { name: /Title/ }));

        const navigation = routerMocks.navigate.mock.calls[0]?.[0] as {
            search: (current: typeof routerMocks.search) => Record<string, unknown>;
            replace: boolean;
            resetScroll: boolean;
        };
        expect(navigation.search(routerMocks.search)).toEqual({
            tab: 'tab-1',
            state: {
                version: 1,
                sections: {
                    'section-1': { sort: { by: 'title', order: 'desc' } },
                    'section-2': { page: 3 },
                },
            },
        });
        expect(navigation).toMatchObject({ replace: true, resetScroll: false });
    });

    it('loads calendar sections by visible month without using paginated section notes', async () => {
        routerMocks.search = {
            tab: 'tab-1',
            state: {
                version: 1,
                sections: {
                    'section-1': { calendar: { year: 2026, month: 8 } },
                },
            },
        };
        mockActiveWorkspace([createSection({ displayType: 'calendar' })]);

        renderViews();

        expect(await screen.findByText('August 2026')).toBeInTheDocument();
        await waitFor(() => {
            expect(fetchViewSectionCalendarNotes).toHaveBeenCalledWith('section-1', {
                start: new Date(2026, 7, 1).toISOString(),
                end: new Date(2026, 8, 1).toISOString(),
            });
        });
        expect(fetchViewSectionNotes).not.toHaveBeenCalled();
    });

    it('retries property metadata failures without reporting a valid calendar property as missing', async () => {
        const user = userEvent.setup();
        routerMocks.search = {
            tab: 'tab-1',
            state: {
                version: 1,
                sections: {
                    'section-1': { calendar: { year: 2026, month: 8 } },
                },
            },
        };
        mockActiveWorkspace([
            createSection({
                displayType: 'calendar',
                displayOptions: {
                    ...createSection().displayOptions,
                    calendarDateField: 'property',
                    calendarDatePropertyKey: 'due-date',
                },
            }),
        ]);
        vi.mocked(fetchAllNotePropertyKeys)
            .mockResolvedValueOnce({
                type: 'error',
                category: 'network',
                errors: [{ code: 'NETWORK_ERROR', message: 'Unavailable' }],
            })
            .mockResolvedValueOnce({
                type: 'success',
                notePropertyKeys: {
                    totalCount: 1,
                    keys: [
                        {
                            key: 'due-date',
                            name: 'Due date',
                            valueType: 'date',
                            noteCount: 0,
                            options: [],
                            updatedAt: '2026-08-13T00:00:00.000Z',
                        },
                    ],
                },
            });

        renderViews();

        expect(await screen.findByText('Failed to load calendar properties')).toBeInTheDocument();
        expect(screen.queryByText('Calendar date property is unavailable')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('August 2026')).toBeInTheDocument();
        expect(fetchAllNotePropertyKeys).toHaveBeenCalledTimes(2);
    });

    it('offers menu fallbacks for moving tabs and sections without dragging', async () => {
        const user = userEvent.setup();
        routerMocks.search = { tab: 'tab-1' };
        mockActiveWorkspace([createSection(), createSection({ id: 'section-2', title: 'Second section', order: 1 })]);
        vi.mocked(reorderViewSections).mockResolvedValue({ type: 'success', reorderViewSections: [] } as never);
        vi.mocked(reorderViewTabs).mockResolvedValue({ type: 'success', reorderViewTabs: [] } as never);

        renderViews();

        const actionButtons = await screen.findAllByRole('button', { name: 'Section actions' });
        await user.click(actionButtons[0]);
        await user.click(await screen.findByRole('menuitem', { name: 'Move down' }));

        await waitFor(() => {
            expect(reorderViewSections).toHaveBeenCalledWith('tab-1', ['section-2', 'section-1']);
        });

        await user.click(screen.getByRole('button', { name: 'View tab actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Move tab right' }));

        await waitFor(() => {
            expect(reorderViewTabs).toHaveBeenCalledWith(['tab-2', 'tab-1']);
        });
    });
});
