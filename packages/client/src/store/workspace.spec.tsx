import { QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Link,
    Outlet,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchWorkspaces } from '~/apis/workspace.api';
import { HOME_ROUTE, NOTE_ROUTE, SETTINGS_ROUTE } from '~/modules/url';
import { validateWorkspaceSearch } from '~/modules/workspace-scope';
import { createTestQueryClient } from '~/test/test-utils';
import { useWorkspace, WorkspaceProvider } from './workspace';

vi.mock('~/apis/workspace.api', () => ({ fetchWorkspaces: vi.fn() }));

const WorkspaceSidebar = () => {
    const { activeWorkspace } = useWorkspace();

    return <aside aria-label="Current workspace">{activeWorkspace?.name}</aside>;
};

describe('workspace navigation', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        vi.mocked(fetchWorkspaces).mockResolvedValue({
            type: 'success',
            workspaces: [
                { id: '1', name: 'Notes', archivedAt: null, createdAt: '1', updatedAt: '1' },
                { id: '2', name: 'Projects', archivedAt: null, createdAt: '1', updatedAt: '1' },
            ],
        });
    });

    it.each([
        ['note', '/42'],
        ['settings', SETTINGS_ROUTE],
    ])('keeps the selected workspace while the %s route is loading', async (_name, destination) => {
        const user = userEvent.setup();
        let finishLoading: () => void = () => undefined;
        const loading = new Promise<void>((resolve) => {
            finishLoading = resolve;
        });
        const rootRoute = createRootRoute({
            validateSearch: validateWorkspaceSearch,
            component: () => (
                <WorkspaceProvider>
                    <WorkspaceSidebar />
                    <Outlet />
                </WorkspaceProvider>
            ),
        });
        const homeRoute = createRoute({
            getParentRoute: () => rootRoute,
            path: HOME_ROUTE,
            component: () => <Link to={destination}>Open destination</Link>,
        });
        const destinationRoute = createRoute({
            getParentRoute: () => rootRoute,
            path: destination === SETTINGS_ROUTE ? SETTINGS_ROUTE : NOTE_ROUTE,
            loader: () => loading,
            component: () => <h1>Destination</h1>,
        });
        const router = createRouter({
            routeTree: rootRoute.addChildren([homeRoute, destinationRoute]),
            history: createMemoryHistory({ initialEntries: ['/?workspace=2'] }),
        });
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
        await act(async () => {
            await router.load();
        });
        const sidebar = await screen.findByRole('complementary', { name: 'Current workspace' });
        expect(sidebar).toHaveTextContent('Projects');

        await user.click(screen.getByRole('link', { name: 'Open destination' }));

        try {
            expect(screen.queryByRole('heading', { name: 'Destination' })).not.toBeInTheDocument();
            expect(sidebar).toHaveTextContent('Projects');
        } finally {
            await act(async () => {
                finishLoading();
                await loading;
            });
        }
        expect(await screen.findByRole('heading', { name: 'Destination' })).toBeInTheDocument();
        expect(sidebar).toHaveTextContent('Projects');
    });
});
