import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CALENDAR_ROUTE, HOME_ROUTE, NOTE_ROUTE } from '~/modules/url';

import MobileCaptureButton from './MobileCaptureButton';

const workspace = vi.hoisted(() => ({
    current: {
        multiple: false,
        activeWorkspace: undefined as { name: string; archivedAt: string | null } | undefined,
    },
}));

vi.mock('~/store/workspace', () => ({ useWorkspace: () => workspace.current }));

const renderAt = async (initialPath: string) => {
    const rootRoute = createRootRoute({
        component: () => (
            <>
                <MobileCaptureButton />
                <Outlet />
            </>
        ),
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren(
            [HOME_ROUTE, NOTE_ROUTE, CALENDAR_ROUTE].map((path) =>
                createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
            ),
        ),
        history: createMemoryHistory({ initialEntries: [initialPath] }),
    });

    render(<RouterProvider router={router} />);
    await act(async () => {
        await router.load();
    });

    return router;
};

beforeEach(() => {
    workspace.current = { multiple: false, activeWorkspace: undefined };
});

describe('<MobileCaptureButton />', () => {
    it.each([
        ['the notes list', HOME_ROUTE],
        ['a saved note', '/42'],
    ])('opens an unsaved new note when tapped on %s', async (_screen, path) => {
        const user = userEvent.setup();
        const router = await renderAt(path);

        await user.click(screen.getByRole('button', { name: 'Capture a new note' }));

        await waitFor(() => {
            expect(router.state.location.pathname).toBe('/new');
        });
    });

    it('names the active workspace when several workspaces exist', async () => {
        workspace.current = { multiple: true, activeWorkspace: { name: 'Projects', archivedAt: null } };

        await renderAt(HOME_ROUTE);

        expect(screen.getByRole('button', { name: 'Capture a new note in Projects' })).toBeInTheDocument();
    });

    it('is not offered on the unsaved new note it would open', async () => {
        await renderAt('/new');

        expect(screen.queryByRole('button', { name: 'Capture a new note' })).not.toBeInTheDocument();
    });

    it('is not offered on screens other than notes', async () => {
        await renderAt(CALENDAR_ROUTE);

        expect(screen.queryByRole('button', { name: 'Capture a new note' })).not.toBeInTheDocument();
    });

    it('is not offered in an archived workspace', async () => {
        workspace.current = { multiple: false, activeWorkspace: { name: 'Old', archivedAt: '1' } };

        await renderAt(HOME_ROUTE);

        expect(screen.queryByRole('button', { name: 'Capture a new note' })).not.toBeInTheDocument();
    });
});
