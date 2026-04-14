import { act, render, screen } from '@testing-library/react';

import { calculateAutoLimit, useGridLimit } from './useGridLimit';

interface GridLimitHarnessProps {
    minItemWidth: number;
    gap: number;
    rows: number;
    fallback?: number;
    override?: number | null;
}

interface ResizeObserverMockInstance {
    callback: ResizeObserverCallback;
    disconnect: ReturnType<typeof vi.fn>;
    observe: ReturnType<typeof vi.fn>;
    trigger: (target: Element) => void;
}

type ResizeObserverCallback = ConstructorParameters<typeof ResizeObserver>[0];

const resizeObserverInstances: ResizeObserverMockInstance[] = [];
let animationFrameQueue = new Map<number, FrameRequestCallback>();
let animationFrameId = 0;

class ResizeObserverMock implements ResizeObserverMockInstance {
    callback: ResizeObserverCallback;
    disconnect = vi.fn();
    observe = vi.fn();

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        resizeObserverInstances.push(this);
    }

    trigger(target: Element) {
        this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
}

function GridLimitHarness(props: GridLimitHarnessProps) {
    const { containerRef, limit, isAutoLimit } = useGridLimit(props);

    return (
        <>
            <output data-testid="limit">{limit}</output>
            <output data-testid="auto-mode">{String(isAutoLimit)}</output>
            <div ref={containerRef} data-testid="grid" />
        </>
    );
}

const setOffsetWidth = (element: HTMLElement, width: number) => {
    Object.defineProperty(element, 'offsetWidth', {
        configurable: true,
        value: width,
    });
};

const flushAnimationFrame = () => {
    const callbacks = Array.from(animationFrameQueue.values());
    animationFrameQueue.clear();
    callbacks.forEach((callback) => callback(0));
};

describe('useGridLimit', () => {
    beforeEach(() => {
        resizeObserverInstances.length = 0;
        animationFrameQueue = new Map();
        animationFrameId = 0;

        vi.stubGlobal('ResizeObserver', ResizeObserverMock);
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            animationFrameId += 1;
            animationFrameQueue.set(animationFrameId, callback);
            return animationFrameId;
        });
        vi.stubGlobal('cancelAnimationFrame', (id: number) => {
            animationFrameQueue.delete(id);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('calculates the auto limit from container width', () => {
        expect(calculateAutoLimit(0, 100, 20, 3)).toBe(3);
        expect(calculateAutoLimit(220, 100, 20, 3)).toBe(6);
        expect(calculateAutoLimit(340, 100, 20, 3)).toBe(9);
    });

    it('recalculates the limit when ResizeObserver reports a new width', () => {
        render(<GridLimitHarness minItemWidth={100} gap={20} rows={3} />);

        const grid = screen.getByTestId('grid');
        const observer = resizeObserverInstances[0];

        setOffsetWidth(grid, 220);
        act(() => {
            observer.trigger(grid);
            flushAnimationFrame();
        });
        expect(screen.getByTestId('limit')).toHaveTextContent('6');

        setOffsetWidth(grid, 356);
        act(() => {
            observer.trigger(grid);
            flushAnimationFrame();
        });
        expect(screen.getByTestId('limit')).toHaveTextContent('9');
        expect(screen.getByTestId('auto-mode')).toHaveTextContent('true');
    });

    it('keeps the current limit when the width jitters around a breakpoint', () => {
        render(<GridLimitHarness minItemWidth={100} gap={20} rows={3} />);

        const grid = screen.getByTestId('grid');
        const observer = resizeObserverInstances[0];

        setOffsetWidth(grid, 340);
        act(() => {
            observer.trigger(grid);
            flushAnimationFrame();
        });
        expect(screen.getByTestId('limit')).toHaveTextContent('9');

        setOffsetWidth(grid, 339);
        act(() => {
            observer.trigger(grid);
            flushAnimationFrame();
        });
        expect(screen.getByTestId('limit')).toHaveTextContent('9');

        setOffsetWidth(grid, 323);
        act(() => {
            observer.trigger(grid);
            flushAnimationFrame();
        });
        expect(screen.getByTestId('limit')).toHaveTextContent('6');
    });

    it('waits for the width to clear the breakpoint buffer before increasing the limit', () => {
        render(<GridLimitHarness minItemWidth={100} gap={20} rows={3} />);

        const grid = screen.getByTestId('grid');
        const observer = resizeObserverInstances[0];

        setOffsetWidth(grid, 339);
        act(() => {
            observer.trigger(grid);
            flushAnimationFrame();
        });
        expect(screen.getByTestId('limit')).toHaveTextContent('6');

        setOffsetWidth(grid, 340);
        act(() => {
            observer.trigger(grid);
            flushAnimationFrame();
        });
        expect(screen.getByTestId('limit')).toHaveTextContent('6');

        setOffsetWidth(grid, 356);
        act(() => {
            observer.trigger(grid);
            flushAnimationFrame();
        });
        expect(screen.getByTestId('limit')).toHaveTextContent('9');
    });

    it('keeps the override limit fixed and disables auto mode', () => {
        render(<GridLimitHarness minItemWidth={100} gap={20} rows={3} override={15} />);

        expect(screen.getByTestId('limit')).toHaveTextContent('15');
        expect(screen.getByTestId('auto-mode')).toHaveTextContent('false');
        expect(resizeObserverInstances).toHaveLength(0);
    });

    it('disconnects the ResizeObserver on unmount', () => {
        const { unmount } = render(<GridLimitHarness minItemWidth={100} gap={20} rows={3} />);

        const observer = resizeObserverInstances[0];

        unmount();

        expect(observer.disconnect).toHaveBeenCalledTimes(1);
    });

    it('falls back to window resize events when ResizeObserver is unavailable', () => {
        vi.unstubAllGlobals();
        vi.stubGlobal('ResizeObserver', undefined);
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            animationFrameId += 1;
            animationFrameQueue.set(animationFrameId, callback);
            return animationFrameId;
        });
        vi.stubGlobal('cancelAnimationFrame', (id: number) => {
            animationFrameQueue.delete(id);
        });

        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount } = render(<GridLimitHarness minItemWidth={100} gap={20} rows={3} />);

        const grid = screen.getByTestId('grid');
        setOffsetWidth(grid, 460);

        act(() => {
            window.dispatchEvent(new Event('resize'));
            flushAnimationFrame();
        });

        expect(screen.getByTestId('limit')).toHaveTextContent('12');
        expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    });
});
