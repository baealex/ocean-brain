import { useLayoutEffect, useRef, useState } from 'react';

interface UseGridLimitOptions {
    minItemWidth: number;
    gap: number;
    rows: number;
    fallback?: number;
    override?: number | null;
}

function calculateAutoLimit(containerWidth: number, minItemWidth: number, gap: number, rows: number): number {
    const cardsPerRow = Math.floor((containerWidth + gap) / (minItemWidth + gap));
    return Math.max(cardsPerRow * rows, rows);
}

export function useGridLimit({
    minItemWidth,
    gap,
    rows,
    fallback,
    override
}: UseGridLimitOptions) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [autoLimit, setAutoLimit] = useState(fallback ?? rows);

    useLayoutEffect(() => {
        if (override) return;
        if (!containerRef.current) return;

        const containerWidth = containerRef.current.offsetWidth;
        const calculatedLimit = calculateAutoLimit(containerWidth, minItemWidth, gap, rows);
        setAutoLimit(calculatedLimit);
    }, [minItemWidth, gap, rows, override]);

    const limit = override ?? autoLimit;
    const isAutoLimit = !override;

    return {
        containerRef,
        limit,
        isAutoLimit
    } as const;
}
