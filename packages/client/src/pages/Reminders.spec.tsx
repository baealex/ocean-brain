import { QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fetchOpenReminderOverview, fetchReminders } from '~/apis/reminder.api';
import { ConfirmProvider, ToastProvider } from '~/components/ui';
import type { Reminder } from '~/models/reminder.model';
import { validateReminderSearch } from '~/modules/route-search';
import { REMINDERS_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';

import Reminders from './Reminders';

vi.mock('~/apis/reminder.api', () => ({
    createReminder: vi.fn(),
    deleteReminder: vi.fn(),
    fetchOpenReminderOverview: vi.fn(),
    fetchReminders: vi.fn(),
    updateReminder: vi.fn(),
}));

const createReminderFixture = (): Reminder => ({
    id: 'reminder-1',
    noteId: 7,
    reminderDate: String(Date.now() - 60_000),
    completed: false,
    priority: 'high',
    content: 'Review the launch checklist',
    createdAt: String(Date.now() - 120_000),
    updatedAt: String(Date.now() - 60_000),
});

const emptyCollection = { totalCount: 0, reminders: [] };

const renderPage = async (initialEntry = '/reminders?status=open&scope=all&priority=all&page=1') => {
    const queryClient = createTestQueryClient();
    const rootRoute = createRootRoute({ component: () => <Reminders /> });
    const remindersRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: REMINDERS_ROUTE,
        validateSearch: validateReminderSearch,
        component: () => null,
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren([remindersRoute]),
        history: createMemoryHistory({ initialEntries: [initialEntry] }),
    });

    render(
        <QueryClientProvider client={queryClient}>
            <ConfirmProvider>
                <ToastProvider>
                    <RouterProvider router={router} />
                </ToastProvider>
            </ConfirmProvider>
        </QueryClientProvider>,
    );

    await act(async () => {
        await router.load();
    });

    return router;
};

describe('<Reminders />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchReminders).mockResolvedValue({
            type: 'success',
            reminders: {
                totalCount: 6,
                reminders: [createReminderFixture()],
            },
        } as never);
    });

    it('opens the scoped list with the same overview date boundary', async () => {
        vi.mocked(fetchOpenReminderOverview).mockResolvedValue({
            type: 'success',
            overdue: {
                totalCount: 6,
                reminders: [createReminderFixture()],
            },
            today: emptyCollection,
            upcoming: emptyCollection,
        } as never);
        const user = userEvent.setup();
        const router = await renderPage();
        expect(await screen.findByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
        const overviewParams = vi.mocked(fetchOpenReminderOverview).mock.calls[0]?.[0];

        await user.click(screen.getByRole('button', { name: /view all/i }));

        await waitFor(() => {
            expect(fetchReminders).toHaveBeenCalledWith({
                filter: {
                    status: 'open',
                    end: overviewParams?.now,
                    sortBy: 'reminderDate',
                    sortOrder: 'desc',
                },
                limit: 25,
                offset: 0,
            });
        });
        expect(router.state.location.search).toMatchObject({ scope: 'overdue', page: 1 });
    });

    it('switches to completed reminders with reset scope and pagination', async () => {
        vi.mocked(fetchOpenReminderOverview).mockResolvedValue({
            type: 'success',
            overdue: emptyCollection,
            today: emptyCollection,
            upcoming: emptyCollection,
        } as never);
        const user = userEvent.setup();
        const router = await renderPage('/reminders?status=open&scope=today&priority=high&page=3');

        await user.click(await screen.findByRole('radio', { name: 'Completed' }));

        await waitFor(() => {
            expect(fetchReminders).toHaveBeenCalledWith({
                filter: {
                    status: 'completed',
                    priority: 'high',
                    sortBy: 'updatedAt',
                    sortOrder: 'desc',
                },
                limit: 25,
                offset: 0,
            });
        });
        expect(router.state.location.search).toMatchObject({ status: 'completed', scope: 'all', page: 1 });
    });
});
