import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';

interface CreateTestRouterOptions {
    initialPath?: string;
    routePath?: string;
    rootComponent: () => ReactNode;
    routeComponent?: () => ReactNode;
}

export const createTestRouter = ({
    initialPath = '/',
    routePath = '/',
    rootComponent,
    routeComponent = () => null,
}: CreateTestRouterOptions) => {
    window.history.pushState({}, '', initialPath);

    const rootRoute = createRootRoute({ component: rootComponent });
    const childRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: routePath,
        component: routeComponent,
    });

    return createRouter({ routeTree: rootRoute.addChildren([childRoute]) });
};
