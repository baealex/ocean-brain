import {
    Outlet,
    createRootRoute,
    createRoute,
    createRouter,
    lazyRouteComponent
} from '@tanstack/react-router';

import { RouteErrorView, RouteNotFoundView, RoutePendingView } from '~/components/app';
import { SiteLayout } from '~/components/layout';
import {
    CALENDAR_ROUTE,
    GRAPH_ROUTE,
    HOME_ROUTE,
    NOTE_ROUTE,
    REMINDERS_ROUTE,
    SEARCH_ROUTE,
    SETTINGS_MCP_ROUTE,
    SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE,
    SETTINGS_MANAGE_IMAGE_ROUTE,
    SETTINGS_PLACEHOLDER_ROUTE,
    SETTINGS_ROUTE,
    SETTINGS_TRASH_ROUTE,
    TAG_NOTES_ROUTE,
    TAG_ROUTE
} from '~/modules/url';
import {
    validateCalendarSearch,
    validateHomeSearch,
    validatePaginationSearch,
    validateSearchPageSearch
} from '~/modules/route-search';
import Home from '~/pages/Home';

const rootRoute = createRootRoute({
    component: () => (
        <SiteLayout>
            <Outlet />
        </SiteLayout>
    ),
    errorComponent: RouteErrorView,
    notFoundComponent: RouteNotFoundView
});

const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: HOME_ROUTE,
    component: Home,
    validateSearch: validateHomeSearch
});

const calendarRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: CALENDAR_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/Calendar')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading calendar"
            description="Preparing note and reminder snapshots."
        />
    ),
    validateSearch: validateCalendarSearch
});

const remindersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: REMINDERS_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/Reminders')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading reminders"
            description="Collecting upcoming reminder cards."
        />
    ),
    validateSearch: validatePaginationSearch
});

const graphRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: GRAPH_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/Graph')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading graph"
            description="Preparing the linked note constellation."
        />
    )
});

const searchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: SEARCH_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/Search')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading search"
            description="Preparing indexed note results."
        />
    ),
    validateSearch: validateSearchPageSearch
});

const tagRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: TAG_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/Tag')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading tags"
            description="Preparing the tag catalog."
        />
    ),
    validateSearch: validatePaginationSearch
});

const noteRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: NOTE_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/Note')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading note"
            description="Preparing the editor and note content."
        />
    )
});

const tagNotesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: TAG_NOTES_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/TagNotes')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading tagged notes"
            description="Preparing notes for the selected tag."
        />
    ),
    validateSearch: validatePaginationSearch
});

const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: SETTINGS_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/setting')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading settings"
            description="Preparing workspace preferences."
        />
    )
});

const mcpRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: SETTINGS_MCP_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/setting/mcp')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading MCP settings"
            description="Preparing MCP access controls."
        />
    )
});

const trashRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: SETTINGS_TRASH_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/setting/trash')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading trash"
            description="Preparing deleted notes for restore."
        />
    ),
    validateSearch: validatePaginationSearch
});

const manageImageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: SETTINGS_MANAGE_IMAGE_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/setting/manage-image')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading image manager"
            description="Preparing uploaded image metadata."
        />
    ),
    validateSearch: validatePaginationSearch
});

const manageImageDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/setting/manage-image-detail')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading image detail"
            description="Preparing references for the selected image."
        />
    )
});

const placeholderRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: SETTINGS_PLACEHOLDER_ROUTE,
    component: lazyRouteComponent(() => import('~/pages/setting/placeholder')),
    pendingComponent: () => (
        <RoutePendingView
            title="Loading placeholders"
            description="Preparing template replacement rules."
        />
    ),
    validateSearch: validatePaginationSearch
});

const routeTree = rootRoute.addChildren([
    homeRoute,
    calendarRoute,
    remindersRoute,
    graphRoute,
    searchRoute,
    tagRoute,
    noteRoute,
    tagNotesRoute,
    settingsRoute,
    mcpRoute,
    trashRoute,
    manageImageRoute,
    manageImageDetailRoute,
    placeholderRoute
]);

export const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPendingComponent: () => (
        <RoutePendingView
            title="Loading page"
            description="Preparing the next route."
        />
    )
});

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
}
