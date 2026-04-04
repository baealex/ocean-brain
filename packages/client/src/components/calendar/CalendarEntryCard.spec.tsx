import { act, render, screen } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import {
    Outlet,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider
} from '@tanstack/react-router';

import { NOTE_ROUTE } from '~/modules/url';

import { CalendarEntryCard } from './CalendarEntryCard';

describe('<CalendarEntryCard />', () => {
    it('renders shared calendar card content inside a navigable surface', async () => {
        const rootRoute = createRootRoute({ component: () => <Outlet /> });
        const noteRoute = createRoute({
            getParentRoute: () => rootRoute,
            path: NOTE_ROUTE,
            component: () => (
                <CalendarEntryCard
                    params={{ id: 'test-note' }}
                    toneClassName="bg-muted"
                    header={<span>Header slot</span>}
                    title="Card title"
                    meta="09:30"
                />
            )
        });
        const router = createRouter({
            routeTree: rootRoute.addChildren([noteRoute]),
            history: createMemoryHistory({ initialEntries: ['/test-note'] })
        });

        render(<RouterProvider router={router} />);

        await act(async () => {
            await router.load();
        });

        expect(screen.getByRole('link', { name: /header slot card title 09:30/i })).toBeInTheDocument();
        expect(screen.getByText('Header slot')).toBeInTheDocument();
        expect(screen.getByText('Card title')).toBeInTheDocument();
        expect(screen.getByText('09:30')).toBeInTheDocument();
    });
});
