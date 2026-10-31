import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';

import type { Reminder } from '~/models/reminder.model';
import { NOTE_ROUTE } from '~/modules/url';

import { ReminderCard } from './ReminderCard';

const createReminder = (overrides: Partial<Reminder>): Reminder => ({
    id: 'reminder-1',
    noteId: 1,
    reminderDate: String(Date.now() + 60 * 60 * 1000),
    completed: false,
    priority: 'high',
    content: 'Review the board',
    createdAt: String(Date.now()),
    updatedAt: String(Date.now()),
    ...overrides,
});

const renderCard = async (reminder: Reminder) => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const noteRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: NOTE_ROUTE,
        component: () => <ReminderCard reminder={reminder} />,
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren([noteRoute]),
        history: createMemoryHistory({ initialEntries: ['/1'] }),
    });

    render(<RouterProvider router={router} />);

    await act(async () => {
        await router.load();
    });
};

describe('<ReminderCard /> in the calendar', () => {
    it('shows the reminder priority as text', async () => {
        await renderCard(createReminder({ priority: 'high' }));

        expect(await screen.findByText('High')).toBeInTheDocument();
    });

    it('marks an open reminder past its time as overdue', async () => {
        await renderCard(createReminder({ reminderDate: String(Date.now() - 60 * 60 * 1000) }));

        expect(await screen.findByText('Overdue')).toBeInTheDocument();
    });

    it('marks a completed reminder as completed instead of overdue', async () => {
        await renderCard(createReminder({ completed: true, reminderDate: String(Date.now() - 60 * 60 * 1000) }));

        expect(await screen.findByText('Completed')).toBeInTheDocument();
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });
});
