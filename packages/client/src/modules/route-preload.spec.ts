import { describe, expect, it } from 'vitest';

import { getRoutePreloadTarget } from './route-preload';
import { APP_ROUTE_PATHS, GRAPH_ROUTE, NOTE_ROUTE } from './url';

describe('getRoutePreloadTarget', () => {
    it.each(['/note-id', '/123/', '/encoded%20note'])('selects the note bundle for %s', (pathname) => {
        expect(getRoutePreloadTarget(pathname)).toBe('note');
    });

    it.each(
        Object.values(APP_ROUTE_PATHS).filter((pathname) => pathname !== NOTE_ROUTE && pathname !== GRAPH_ROUTE),
    )('does not preload a heavy route bundle for %s', (pathname) => {
        expect(getRoutePreloadTarget(pathname)).toBeNull();
    });

    it('ignores unmatched nested paths', () => {
        const pathname = '/unknown/path';

        expect(getRoutePreloadTarget(pathname)).toBeNull();
    });

    it('selects the graph bundle for the graph route', () => {
        expect(getRoutePreloadTarget('/graph')).toBe('graph');
    });
});
