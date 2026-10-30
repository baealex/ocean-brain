// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { type GraphAreaShape, getGraphViewportFit } from './graph-fit';

const viewport = {
    width: 360,
    height: 600,
    padding: { top: 60, right: 24, bottom: 24, left: 24 },
    minZoom: 0.3,
    maxZoom: 5,
};

const toScreen = (value: number, center: number, zoom: number, size: number) => (value - center) * zoom + size / 2;

describe('graph viewport fit', () => {
    it('frames areas at both sides of the map inside the padded viewport', () => {
        const leftArea: GraphAreaShape = { centerX: -120, centerY: 0, radiusX: 40, radiusY: 30 };
        const rightArea: GraphAreaShape = { centerX: 160, centerY: 40, radiusX: 30, radiusY: 30 };

        const fit = getGraphViewportFit({ ...viewport, areas: [leftArea, rightArea] });

        expect(fit).not.toBeNull();
        if (!fit) return;
        const left = toScreen(leftArea.centerX - leftArea.radiusX, fit.centerX, fit.zoom, viewport.width);
        const right = toScreen(rightArea.centerX + rightArea.radiusX, fit.centerX, fit.zoom, viewport.width);
        expect(left).toBeCloseTo(viewport.padding.left);
        expect(right).toBeCloseTo(viewport.width - viewport.padding.right);
    });

    it('keeps the top of the highest area and its label below the zoom controls', () => {
        const area: GraphAreaShape = { centerX: 0, centerY: 0, radiusX: 60, radiusY: 200 };

        const fit = getGraphViewportFit({ ...viewport, areas: [area] });

        expect(fit).not.toBeNull();
        if (!fit) return;
        const areaTop = toScreen(area.centerY - area.radiusY, fit.centerY, fit.zoom, viewport.height);
        expect(areaTop).toBeGreaterThanOrEqual(viewport.padding.top - 0.5);
    });

    it('returns no fit when there is nothing to frame', () => {
        expect(getGraphViewportFit({ ...viewport, areas: [] })).toBeNull();
    });
});
