import {
    useCallback,
    useLayoutEffect,
    useRef,
    useState
} from 'react';

interface UseGridLimitOptions {
    minItemWidth: number;
    gap: number;
    rows: number;
    fallback?: number;
    override?: number | null;
}

const GRID_LIMIT_BREAKPOINT_BUFFER_PX = 16;

function calculateCardsPerRow(
    containerWidth: number,
    minItemWidth: number,
    gap: number
): number {
    return Math.max(
        Math.floor((Math.max(containerWidth, 0) + gap) / (minItemWidth + gap)),
        1
    );
}

function getMinimumWidthForColumns(
    columns: number,
    minItemWidth: number,
    gap: number
): number {
    return columns * minItemWidth + (columns - 1) * gap;
}

export function calculateAutoLimit(
    containerWidth: number,
    minItemWidth: number,
    gap: number,
    rows: number
): number {
    const cardsPerRow = calculateCardsPerRow(containerWidth, minItemWidth, gap);

    return Math.max(cardsPerRow * rows, rows);
}

export function useGridLimit({
    minItemWidth,
    gap,
    rows,
    fallback,
    override
}: UseGridLimitOptions) {
    const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
    const [autoLimit, setAutoLimit] = useState(fallback ?? rows);
    const previousCardsPerRowRef = useRef<number | null>(null);

    const containerRef = useCallback((node: HTMLDivElement | null) => {
        setContainerElement(node);
    }, []);

    const isAutoLimit = override == null;
    const limit = isAutoLimit ? autoLimit : override;

    useLayoutEffect(() => {
        if (!isAutoLimit) {
            previousCardsPerRowRef.current = null;
            return;
        }

        if (!containerElement) {
            previousCardsPerRowRef.current = null;
            setAutoLimit(prev => prev === (fallback ?? rows) ? prev : (fallback ?? rows));
            return;
        }

        let frameId: number | null = null;

        const measure = () => {
            const containerWidth = containerElement.offsetWidth;
            const measuredCardsPerRow = calculateCardsPerRow(
                containerWidth,
                minItemWidth,
                gap
            );
            const previousCardsPerRow = previousCardsPerRowRef.current;

            let nextCardsPerRow = measuredCardsPerRow;

            if (previousCardsPerRow !== null && previousCardsPerRow !== measuredCardsPerRow) {
                if (measuredCardsPerRow > previousCardsPerRow) {
                    const nextBreakpoint = getMinimumWidthForColumns(
                        previousCardsPerRow + 1,
                        minItemWidth,
                        gap
                    );

                    if (containerWidth < nextBreakpoint + GRID_LIMIT_BREAKPOINT_BUFFER_PX) {
                        nextCardsPerRow = previousCardsPerRow;
                    }
                } else {
                    const previousBreakpoint = getMinimumWidthForColumns(
                        previousCardsPerRow,
                        minItemWidth,
                        gap
                    );

                    if (containerWidth > previousBreakpoint - GRID_LIMIT_BREAKPOINT_BUFFER_PX) {
                        nextCardsPerRow = previousCardsPerRow;
                    }
                }
            }

            previousCardsPerRowRef.current = nextCardsPerRow;

            const nextLimit = Math.max(nextCardsPerRow * rows, rows);

            setAutoLimit(prev => prev === nextLimit ? prev : nextLimit);
        };

        const scheduleMeasure = () => {
            if (frameId !== null) {
                return;
            }

            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                measure();
            });
        };

        scheduleMeasure();

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => {
                scheduleMeasure();
            });

            observer.observe(containerElement);

            return () => {
                observer.disconnect();
                if (frameId !== null) {
                    window.cancelAnimationFrame(frameId);
                }
            };
        }

        window.addEventListener('resize', scheduleMeasure);
        window.addEventListener('orientationchange', scheduleMeasure);

        return () => {
            window.removeEventListener('resize', scheduleMeasure);
            window.removeEventListener('orientationchange', scheduleMeasure);
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [
        containerElement,
        fallback,
        gap,
        isAutoLimit,
        minItemWidth,
        rows
    ]);

    return {
        containerRef,
        limit,
        isAutoLimit
    } as const;
}
