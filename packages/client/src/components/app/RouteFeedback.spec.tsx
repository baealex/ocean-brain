import { RouterProvider } from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { createTestRouter } from '~/test/create-test-router';

import { RouteErrorView, RouteNotFoundView, RoutePendingView } from './RouteFeedback';

describe('RouteFeedback', () => {
    const renderWithRouter = async (component: () => ReactNode) => {
        const router = createTestRouter({
            initialPath: '/',
            routePath: '/',
            rootComponent: component,
        });

        render(<RouterProvider router={router} />);
        await act(async () => {
            await router.load();
        });
    };

    it('renders the pending skeleton layout without a visible page header', () => {
        const { container } = render(
            <RoutePendingView title="Loading graph" description="Preparing the linked note constellation." />,
        );

        expect(screen.queryByText('Loading graph')).not.toBeInTheDocument();
        expect(container.querySelectorAll('.animate-shimmer')).toHaveLength(3);
    });

    it('renders the route error message and recovery actions', async () => {
        await renderWithRouter(() => (
            <RouteErrorView
                error={{
                    errors: [
                        {
                            code: 'GRAPHQL_ERROR',
                            message: 'Graph exploded',
                        },
                    ],
                }}
                reset={vi.fn()}
            />
        ));

        expect(screen.getByText('Route failed to render')).toBeInTheDocument();
        expect(screen.getByText('Graph exploded')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument();
    });

    it('renders the not found fallback', async () => {
        await renderWithRouter(() => <RouteNotFoundView />);

        expect(screen.getByText('This page does not exist.')).toBeInTheDocument();
        expect(screen.getByText('Check the URL or navigate from the sidebar.')).toBeInTheDocument();
    });
});
