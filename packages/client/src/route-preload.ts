import { getRoutePreloadTarget } from './modules/route-preload';

const preloadTarget = getRoutePreloadTarget(window.location.pathname);

// Best-effort only: TanStack Router owns the real navigation load and its error recovery.
if (preloadTarget === 'note') {
    void import('./pages/Note').catch(() => undefined);
} else if (preloadTarget === 'graph') {
    void import('./pages/Graph').catch(() => undefined);
}
