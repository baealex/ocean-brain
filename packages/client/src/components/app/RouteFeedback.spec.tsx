import { render, screen } from '@testing-library/react';

import {
    RouteErrorView,
    RouteNotFoundView,
    RoutePendingView
} from './RouteFeedback';

describe('RouteFeedback', () => {
    it('renders the pending skeleton layout without a visible page header', () => {
        const { container } = render(
            <RoutePendingView
                title="Loading graph"
                description="Preparing the linked note constellation."
            />
        );

        expect(screen.queryByText('Loading graph')).not.toBeInTheDocument();
        expect(container.querySelectorAll('.animate-shimmer')).toHaveLength(3);
    });

    it('renders the route error message', () => {
        render(<RouteErrorView error={new Error('Boom')} />);

        expect(screen.getByText('Route failed to render')).toBeInTheDocument();
        expect(screen.getByText('Boom')).toBeInTheDocument();
    });

    it('renders the not found fallback', () => {
        render(<RouteNotFoundView />);

        expect(screen.getByText('This page does not exist.')).toBeInTheDocument();
        expect(screen.getByText('Check the URL or navigate from the sidebar.')).toBeInTheDocument();
    });
});
