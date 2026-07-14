import { APP_ROUTE_PATHS, GRAPH_ROUTE, NOTE_ROUTE } from './url';

export type RoutePreloadTarget = 'graph' | 'note';

const NON_NOTE_ROOT_SEGMENTS = new Set(
    Object.values(APP_ROUTE_PATHS)
        .filter((routePath) => routePath !== NOTE_ROUTE)
        .map((routePath) => routePath.split('/')[1])
        .filter((segment): segment is string => Boolean(segment)),
);

export const getRoutePreloadTarget = (pathname: string): RoutePreloadTarget | null => {
    const segments = pathname.split('/').filter(Boolean);

    if (segments.length !== 1) {
        return null;
    }

    const [firstSegment] = segments;

    if (`/${firstSegment}` === GRAPH_ROUTE) {
        return 'graph';
    }

    if (!firstSegment || NON_NOTE_ROOT_SEGMENTS.has(firstSegment)) {
        return null;
    }

    return 'note';
};
