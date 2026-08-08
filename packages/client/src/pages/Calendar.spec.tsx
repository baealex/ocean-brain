import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { validateCalendarSearch } from '~/modules/route-search';
import { CALENDAR_ROUTE } from '~/modules/url';

import Calendar from './Calendar';

const calendarMocks = vi.hoisted(() => ({
    useCalendarData: vi.fn(),
}));

vi.mock('~/components/calendar', async () => {
    const actual = await vi.importActual<typeof import('~/components/calendar')>('~/components/calendar');

    return {
        ...actual,
        useCalendarData: calendarMocks.useCalendarData,
    };
});

const createNoteFixture = (createdAt: number, updatedAt: number): Note => ({
    id: 'note-1',
    title: 'Leap-day note',
    content: '',
    pinned: false,
    order: 0,
    layout: 'wide',
    tags: [],
    properties: [],
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
});

const createReminderFixture = (reminderDate: number): Reminder => ({
    id: 'reminder-1',
    noteId: 1,
    reminderDate: String(reminderDate),
    completed: false,
    priority: 'medium',
    content: 'Leap-day reminder',
    createdAt: String(reminderDate),
    updatedAt: String(reminderDate),
});

const renderPage = async (initialEntry: string) => {
    const rootRoute = createRootRoute({ component: () => <Calendar /> });
    const calendarRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: CALENDAR_ROUTE,
        validateSearch: validateCalendarSearch,
        component: () => null,
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren([calendarRoute]),
        history: createMemoryHistory({ initialEntries: [initialEntry] }),
    });

    render(<RouterProvider router={router} />);

    await act(async () => {
        await router.load();
    });

    return router;
};

describe('<Calendar />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calendarMocks.useCalendarData.mockReturnValue({
            notes: [],
            reminders: [],
            isLoading: false,
            isError: false,
        });
    });

    it('groups created notes and reminders on leap day', async () => {
        const leapDay = new Date(2024, 1, 29, 12).getTime();
        const marchFirst = new Date(2024, 2, 1, 12).getTime();
        calendarMocks.useCalendarData.mockReturnValue({
            notes: [createNoteFixture(leapDay, marchFirst)],
            reminders: [createReminderFixture(leapDay)],
            isLoading: false,
            isError: false,
        });

        await renderPage('/calendar?year=2024&month=2&type=create');

        expect(
            screen.getByRole('button', {
                name: 'Thursday, February 29, 2024, 1 note, 1 reminder',
            }),
        ).toBeInTheDocument();
    });

    it('navigates from January to December of the previous year', async () => {
        const user = userEvent.setup();
        const router = await renderPage('/calendar?year=2026&month=1&type=create');

        await user.click(screen.getByRole('button', { name: 'Previous month' }));

        await waitFor(() => {
            expect(router.state.location.search).toMatchObject({ year: 2025, month: 12, type: 'create' });
        });
    });
});
