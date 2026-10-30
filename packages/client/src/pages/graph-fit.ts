const AREA_MIN_RADIUS_X = 30;
const AREA_MIN_RADIUS_Y = 28;
const AREA_NODE_MARGIN = 18;

export interface GraphAreaShape {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
}

export interface GraphFitPadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

interface GraphViewportFitOptions {
    areas: GraphAreaShape[];
    width: number;
    height: number;
    padding: GraphFitPadding;
    minZoom: number;
    maxZoom: number;
}

export interface GraphViewportFit {
    centerX: number;
    centerY: number;
    zoom: number;
}

export function getGraphAreaShape(points: Array<{ x?: number; y?: number }>, fallback: { x: number; y: number }) {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of points) {
        const x = point.x ?? fallback.x;
        const y = point.y ?? fallback.y;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }

    return {
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        radiusX: Math.max(AREA_MIN_RADIUS_X, (maxX - minX) / 2 + AREA_NODE_MARGIN),
        radiusY: Math.max(AREA_MIN_RADIUS_Y, (maxY - minY) / 2 + AREA_NODE_MARGIN),
    } satisfies GraphAreaShape;
}

// Asymmetric padding keeps fitted areas clear of floating controls.
export function getGraphViewportFit({
    areas,
    width,
    height,
    padding,
    minZoom,
    maxZoom,
}: GraphViewportFitOptions): GraphViewportFit | null {
    const availableWidth = width - padding.left - padding.right;
    const availableHeight = height - padding.top - padding.bottom;

    if (areas.length === 0 || availableWidth <= 0 || availableHeight <= 0) {
        return null;
    }

    const minX = Math.min(...areas.map((area) => area.centerX - area.radiusX));
    const maxX = Math.max(...areas.map((area) => area.centerX + area.radiusX));
    const minY = Math.min(...areas.map((area) => area.centerY - area.radiusY));
    const maxY = Math.max(...areas.map((area) => area.centerY + area.radiusY));
    const zoom = Math.min(
        maxZoom,
        Math.max(minZoom, Math.min(availableWidth / (maxX - minX), availableHeight / (maxY - minY))),
    );
    const contentCenterX = padding.left + availableWidth / 2;
    const contentCenterY = padding.top + availableHeight / 2;

    return {
        centerX: (minX + maxX) / 2 - (contentCenterX - width / 2) / zoom,
        centerY: (minY + maxY) / 2 - (contentCenterY - height / 2) / zoom,
        zoom,
    };
}
