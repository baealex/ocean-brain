import {
    useCallback,
    useLayoutEffect,
    useState
} from 'react';

interface UseGridLimitOptions {
    minItemWidth: number;
    gap: number;
    rows: number;
    fallback?: number;
    override?: number | null;
}

export function calculateAutoLimit(
    containerWidth: number,
    minItemWidth: number,
    gap: number,
    rows: number
): number {
    const cardsPerRow = Math.max(
        Math.floor((Math.max(containerWidth, 0) + gap) / (minItemWidth + gap)),
        1
    );

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

    const containerRef = useCallback((node: HTMLDivElement | null) => {
        setContainerElement(node);
    }, []);

    const isAutoLimit = override == null;
    const limit = isAutoLimit ? autoLimit : override;

    useLayoutEffect(() => {
        if (!isAutoLimit) {
            return;
        }

        if (!containerElement) {
            setAutoLimit(prev => prev === (fallback ?? rows) ? prev : (fallback ?? rows));
            return;
        }

        let frameId: number | null = null;

        const measure = () => {
            const nextLimit = calculateAutoLimit(
                containerElement.offsetWidth,
                minItemWidth,
                gap,
                rows
            );

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
