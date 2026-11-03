import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, within } from '@testing-library/react';
import type { Workspace } from '~/models/workspace.model';
import { HOME_ROUTE, NOTE_ROUTE, SETTINGS_WORKSPACE_ROUTE } from '~/modules/url';
import { createQueryClientWrapper } from '~/test/test-utils';

import SidebarWorkspaces, { moveWorkspace } from './SidebarWorkspaces';

const workspace = vi.hoisted(() => ({
    current: {
        workspaceId: '1',
        workspaces: [] as Workspace[],
    },
}));

vi.mock('~/store/workspace', () => ({ useWorkspace: () => workspace.current }));
vi.mock('./PinnedNotesPanel', () => ({
    default: ({ workspaceId }: { workspaceId: string }) => <div>Pinned notes of workspace {workspaceId}</div>,
}));

const createWorkspace = (id: string, name: string, archivedAt: string | null = null): Workspace => ({
    id,
    name,
    archivedAt,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
});

const renderSidebar = async () => {
    const rootRoute = createRootRoute({
        component: () => (
            <>
                <SidebarWorkspaces />
                <Outlet />
            </>
        ),
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren(
            [HOME_ROUTE, NOTE_ROUTE, SETTINGS_WORKSPACE_ROUTE].map((path) =>
                createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
            ),
        ),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    render(<RouterProvider router={router} />, { wrapper: createQueryClientWrapper().Wrapper });
    await act(async () => {
        await router.load();
    });
};

const workspaceSearchParam = (link: HTMLElement) =>
    new URL(link.getAttribute('href') ?? '', 'http://localhost').searchParams.get('workspace')?.replaceAll('"', '');

beforeEach(() => {
    workspace.current = {
        workspaceId: '1',
        workspaces: [createWorkspace('1', 'Notes'), createWorkspace('2', 'Diet')],
    };
});

describe('<SidebarWorkspaces />', () => {
    it('lists the pinned notes of every workspace under its name', async () => {
        await renderSidebar();

        const diet = screen.getByRole('region', { name: 'Diet' });

        expect(within(diet).getByText('Pinned notes of workspace 2')).toBeInTheDocument();
    });

    it('marks the workspace the user is in', async () => {
        workspace.current.workspaceId = '2';

        await renderSidebar();

        expect(screen.getByRole('link', { name: 'Diet' })).toHaveAttribute('aria-current', 'true');
        expect(screen.getByRole('link', { name: 'Notes' })).not.toHaveAttribute('aria-current');
    });

    it('opens the note list of a workspace from its name', async () => {
        await renderSidebar();

        const link = screen.getByRole('link', { name: 'Diet' });

        expect(new URL(link.getAttribute('href') ?? '', 'http://localhost').pathname).toBe(HOME_ROUTE);
        expect(workspaceSearchParam(link)).toBe('2');
    });

    it('creates a new note inside the workspace whose plus button is used', async () => {
        await renderSidebar();

        const link = screen.getByRole('link', { name: 'New note in Diet' });

        expect(new URL(link.getAttribute('href') ?? '', 'http://localhost').pathname).toBe('/new');
        expect(workspaceSearchParam(link)).toBe('2');
    });

    it('opens the settings of the workspace whose settings button is used', async () => {
        await renderSidebar();

        const link = screen.getByRole('link', { name: 'Diet settings' });

        expect(new URL(link.getAttribute('href') ?? '', 'http://localhost').pathname).toBe(SETTINGS_WORKSPACE_ROUTE);
        expect(workspaceSearchParam(link)).toBe('2');
    });

    it('leaves out archived workspaces the user is not in', async () => {
        workspace.current.workspaces = [createWorkspace('1', 'Notes'), createWorkspace('3', 'Old', '2026-02-01')];

        await renderSidebar();

        expect(screen.queryByRole('region', { name: 'Old' })).not.toBeInTheDocument();
    });

    it('shows an archived workspace the user is in as read only', async () => {
        workspace.current = {
            workspaceId: '3',
            workspaces: [createWorkspace('1', 'Notes'), createWorkspace('3', 'Old', '2026-02-01')],
        };

        await renderSidebar();

        const old = screen.getByRole('region', { name: 'Old' });
        expect(within(old).getByText('Archived · read only')).toBeInTheDocument();
        expect(within(old).queryByRole('link', { name: 'New note in Old' })).not.toBeInTheDocument();
    });

    it('offers keyboard users a way to reorder each workspace', async () => {
        await renderSidebar();

        expect(screen.getByRole('button', { name: 'Reorder workspace Diet' })).toBeInTheDocument();
    });

    it('keeps hidden archived workspaces in the saved order when a workspace moves', () => {
        const workspaces = [
            createWorkspace('1', 'Notes'),
            createWorkspace('3', 'Old', '2026-02-01'),
            createWorkspace('2', 'Diet'),
        ];

        const next = moveWorkspace(workspaces, '2', '1');

        expect(next?.map((item) => item.id)).toEqual(['2', '1', '3']);
    });
});
