import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { fetchAllNotePropertyKeys } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import {
    fetchViewCalendarNotes,
    fetchViewNotes,
    fetchViewWorkspace,
    reorderViewGroups,
    reorderViews,
    updateView,
} from '~/apis/view.api';
import { ConfirmProvider, ToastProvider } from '~/components/ui';
import type { View } from '~/models/view.model';
import { createQueryClientWrapper } from '~/test/test-utils';

import Views from './Views';

beforeAll(() => {
    Object.defineProperties(HTMLElement.prototype, {
        hasPointerCapture: { configurable: true, value: () => false },
        setPointerCapture: { configurable: true, value: () => undefined },
        releasePointerCapture: { configurable: true, value: () => undefined },
        scrollIntoView: { configurable: true, value: () => undefined },
    });
});

const routerMocks = vi.hoisted(() => ({
    search: {} as Record<string, unknown>,
    navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => routerMocks.navigate,
    Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
    getRouteApi: () => ({
        useSearch: () => routerMocks.search,
        useNavigate: () => routerMocks.navigate,
    }),
}));

vi.mock('~/apis/note.api', () => ({ fetchAllNotePropertyKeys: vi.fn() }));
vi.mock('~/apis/tag.api', () => ({ fetchTags: vi.fn() }));
vi.mock('~/apis/view.api', () => ({
    createView: vi.fn(),
    createViewGroup: vi.fn(),
    deleteView: vi.fn(),
    deleteViewGroup: vi.fn(),
    fetchViewCalendarNotes: vi.fn(),
    fetchViewWorkspace: vi.fn(),
    fetchViewNotes: vi.fn(),
    reorderViews: vi.fn(),
    reorderViewGroups: vi.fn(),
    setActiveViewGroup: vi.fn(),
    updateView: vi.fn(),
    updateViewGroup: vi.fn(),
}));

const createView = (patch: Partial<View> = {}): View => ({
    id: 'view-1',
    groupId: 'group-1',
    title: 'First view',
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

const mockActiveWorkspace = (views: View[]) => {
    vi.mocked(fetchViewWorkspace).mockResolvedValue({
        type: 'success',
        viewWorkspace: {
            activeGroupId: 'group-1',
            groups: [
                {
                    id: 'group-1',
                    title: 'Work',
                    order: 0,
                    views,
                },
                {
                    id: 'group-2',
                    title: 'Later',
                    order: 1,
                    views: [],
                },
            ],
        },
    } as never);
    vi.mocked(fetchViewNotes).mockResolvedValue({
        type: 'success',
        viewNotes: { totalCount: 0, notes: [] },
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
                activeGroupId: null,
                groups: [],
            },
        } as never);
        vi.mocked(fetchViewCalendarNotes).mockResolvedValue({
            type: 'success',
            viewCalendarNotes: [],
        } as never);
    });

    it('renders the first-group onboarding when there are no saved views', async () => {
        renderViews();

        expect(await screen.findByText('Create your first view group')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create first group' })).toBeInTheDocument();
    });

    it('changes a list sort temporarily without saving the view', async () => {
        const user = userEvent.setup();
        routerMocks.search = {
            group: 'group-1',
            state: { version: 2, views: { 'view-1': { page: 2 }, 'view-2': { page: 3 } } },
        };
        mockActiveWorkspace([createView()]);
        renderViews();

        await user.click(await screen.findByRole('button', { name: 'Sort: Recently updated' }));
        await user.click(await screen.findByRole('menuitemradio', { name: 'Title: A to Z' }));

        expect(routerMocks.navigate.mock.lastCall?.[0].search(routerMocks.search)).toEqual({
            group: 'group-1',
            state: {
                version: 2,
                views: { 'view-1': { sort: { by: 'title', order: 'asc' } }, 'view-2': { page: 3 } },
            },
        });
        expect(updateView).not.toHaveBeenCalled();
    });

    it('labels tag filters separately from the view layout', async () => {
        mockActiveWorkspace([
            createView({
                displayType: 'calendar',
                tagNames: ['project'],
                displayOptions: { ...createView().displayOptions, calendarDateField: 'updatedAt' },
            }),
        ]);
        renderViews();

        const filters = await screen.findByRole('group', { name: 'View filters' });

        expect(within(filters).getByText('@project')).toBeInTheDocument();
        expect(within(filters).queryByText(/Calendar/)).not.toBeInTheDocument();
        expect(screen.getByText('Calendar · by Updated date')).toBeInTheDocument();
    });

    it('opens table columns directly without unrelated view settings', async () => {
        const user = userEvent.setup();
        mockActiveWorkspace([createView({ displayType: 'table' })]);
        renderViews();

        await user.click(await screen.findByRole('button', { name: 'Columns', exact: true }));

        expect(screen.getByRole('heading', { name: 'Table columns' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reorder Title column' })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'View name' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add property filter' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(updateView).not.toHaveBeenCalled();
    });

    it('keeps the column draft open when saving fails', async () => {
        const user = userEvent.setup();
        mockActiveWorkspace([
            createView({
                displayType: 'table',
                tagNames: ['@work'],
                displayOptions: { ...createView().displayOptions, tableColumns: ['title', 'tags'] },
            }),
        ]);
        vi.mocked(updateView).mockResolvedValue({
            type: 'error',
            category: 'network',
            errors: [{ code: 'NETWORK_ERROR', message: 'Columns could not be saved.' }],
        });
        renderViews();

        await user.click(await screen.findByRole('button', { name: 'Columns', exact: true }));
        await user.click(screen.getByRole('checkbox', { name: 'Show Tags column' }));
        await user.click(screen.getByRole('button', { name: 'Save columns', exact: true }));

        expect(await screen.findByText('Columns could not be saved.')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Show Tags column' })).not.toBeChecked();
        expect(updateView).toHaveBeenCalledWith(
            'view-1',
            expect.objectContaining({
                tagNames: ['@work'],
                displayOptions: expect.objectContaining({ tableColumns: ['title'] }),
            }),
        );
    });

    it('saves the temporary sort without overwriting view filters or other navigation state', async () => {
        const user = userEvent.setup();
        routerMocks.search = {
            group: 'group-1',
            state: {
                version: 2,
                views: { 'view-1': { sort: { by: 'title', order: 'asc' } }, 'view-2': { page: 3 } },
            },
        };
        mockActiveWorkspace([createView({ tagNames: ['@work'] })]);
        vi.mocked(updateView).mockResolvedValue({ type: 'success', updateView: { id: 'view-1' } });
        renderViews();

        await user.click(await screen.findByRole('button', { name: 'Save default sort' }));

        await waitFor(() =>
            expect(updateView).toHaveBeenCalledWith('view-1', {
                title: 'First view',
                displayType: 'list',
                displayOptions: createView().displayOptions,
                tagNames: ['@work'],
                mode: 'and',
                propertyFilters: [],
                sortBy: 'title',
                sortOrder: 'asc',
                limit: 5,
            }),
        );
        expect(routerMocks.navigate.mock.lastCall?.[0].search(routerMocks.search)).toEqual({
            group: 'group-1',
            state: { version: 2, views: { 'view-2': { page: 3 } } },
        });
    });

    it('keeps the temporary sort available for retry when saving fails', async () => {
        const user = userEvent.setup();
        routerMocks.search = {
            state: { version: 2, views: { 'view-1': { sort: { by: 'title', order: 'asc' } } } },
        };
        mockActiveWorkspace([createView()]);
        vi.mocked(updateView).mockResolvedValue({
            type: 'error',
            category: 'network',
            errors: [{ code: 'NETWORK_ERROR', message: 'Failed to save the default sort.' }],
        });
        renderViews();

        await user.click(await screen.findByRole('button', { name: 'Save default sort' }));

        expect(await screen.findByText('Failed to save the default sort.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save default sort' })).toBeEnabled();
        expect(routerMocks.navigate).not.toHaveBeenCalled();
    });

    it('resets a temporary sort and its page without saving or changing other views', async () => {
        const user = userEvent.setup();
        routerMocks.search = {
            group: 'group-1',
            state: {
                version: 2,
                views: { 'view-1': { page: 2, sort: { by: 'title', order: 'asc' } }, 'view-2': { page: 3 } },
            },
        };
        mockActiveWorkspace([createView()]);
        renderViews();

        await user.click(await screen.findByRole('button', { name: 'Reset sort' }));

        expect(routerMocks.navigate.mock.lastCall?.[0].search(routerMocks.search)).toEqual({
            group: 'group-1',
            state: { version: 2, views: { 'view-2': { page: 3 } } },
        });
        expect(updateView).not.toHaveBeenCalled();
    });

    it('restores and updates a table sort through the per-view URL state', async () => {
        const user = userEvent.setup();
        routerMocks.search = {
            group: 'group-1',
            state: {
                version: 2,
                views: {
                    'view-1': { page: 2, sort: { by: 'title', order: 'asc' } },
                    'view-2': { page: 3 },
                },
            },
        };
        mockActiveWorkspace([
            createView({ displayType: 'table' }),
            createView({ id: 'view-2', title: 'Second view', order: 1 }),
        ]);
        vi.mocked(fetchViewNotes).mockResolvedValue({
            type: 'success',
            viewNotes: {
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

        await screen.findAllByRole('button', { name: 'View actions' });

        expect(fetchViewNotes).toHaveBeenCalledWith('view-1', {
            limit: 5,
            offset: 5,
            sortBy: 'title',
            sortOrder: 'asc',
        });
        expect(fetchViewNotes).toHaveBeenCalledWith('view-2', {
            limit: 5,
            offset: 10,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });

        await user.click(within(await screen.findByRole('table')).getByRole('button', { name: /Title/ }));

        const navigation = routerMocks.navigate.mock.calls[0]?.[0] as {
            search: (current: typeof routerMocks.search) => Record<string, unknown>;
            replace: boolean;
            resetScroll: boolean;
        };
        expect(navigation.search(routerMocks.search)).toEqual({
            group: 'group-1',
            state: {
                version: 2,
                views: {
                    'view-1': { sort: { by: 'title', order: 'desc' } },
                    'view-2': { page: 3 },
                },
            },
        });
        expect(navigation).toMatchObject({ replace: true, resetScroll: false });
    });

    it('loads calendar views by visible month without using paginated view notes', async () => {
        routerMocks.search = {
            group: 'group-1',
            state: {
                version: 2,
                views: {
                    'view-1': { calendar: { year: 2026, month: 8 } },
                },
            },
        };
        mockActiveWorkspace([createView({ displayType: 'calendar' })]);

        renderViews();

        expect(await screen.findByText('August 2026')).toBeInTheDocument();
        await waitFor(() => {
            expect(fetchViewCalendarNotes).toHaveBeenCalledWith('view-1', {
                start: new Date(2026, 7, 1).toISOString(),
                end: new Date(2026, 8, 1).toISOString(),
            });
        });
        expect(fetchViewNotes).not.toHaveBeenCalled();
    });

    it('retries property metadata failures without reporting a valid calendar property as missing', async () => {
        const user = userEvent.setup();
        routerMocks.search = {
            group: 'group-1',
            state: {
                version: 2,
                views: {
                    'view-1': { calendar: { year: 2026, month: 8 } },
                },
            },
        };
        mockActiveWorkspace([
            createView({
                displayType: 'calendar',
                displayOptions: {
                    ...createView().displayOptions,
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

    it('offers menu fallbacks for moving groups and views without dragging', async () => {
        const user = userEvent.setup();
        routerMocks.search = { group: 'group-1' };
        mockActiveWorkspace([createView(), createView({ id: 'view-2', title: 'Second view', order: 1 })]);
        vi.mocked(reorderViews).mockResolvedValue({ type: 'success', reorderViews: [] } as never);
        vi.mocked(reorderViewGroups).mockResolvedValue({ type: 'success', reorderViewGroups: [] } as never);

        renderViews();

        const actionButtons = await screen.findAllByRole('button', { name: 'View actions' });
        await user.click(actionButtons[0]);
        await user.click(await screen.findByRole('menuitem', { name: 'Move down' }));

        await waitFor(() => {
            expect(reorderViews).toHaveBeenCalledWith('group-1', ['view-2', 'view-1']);
        });

        await user.click(screen.getByRole('button', { name: 'View group actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Move group right' }));

        await waitFor(() => {
            expect(reorderViewGroups).toHaveBeenCalledWith(['group-2', 'group-1'], '1');
        });
    });
});
