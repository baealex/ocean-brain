import { act, renderHook } from '@testing-library/react';

import useDebounce from './useDebounce';

const flushMicrotasks = async () => {
    await Promise.resolve();
};

describe('useDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('executes only the latest callback across rapid calls', async () => {
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();
        const thirdCallback = vi.fn();

        const { result } = renderHook(() => useDebounce(1000));

        act(() => {
            result.current[1](firstCallback);
            result.current[1](secondCallback);
            result.current[1](thirdCallback);
        });

        expect(result.current[0]).toBe(true);

        await act(async () => {
            vi.advanceTimersByTime(1000);
            await flushMicrotasks();
        });

        expect(firstCallback).not.toHaveBeenCalled();
        expect(secondCallback).not.toHaveBeenCalled();
        expect(thirdCallback).toHaveBeenCalledTimes(1);
        expect(result.current[0]).toBe(false);
    });

    it('does not execute a pending callback after unmount', async () => {
        const callback = vi.fn();

        const { result, unmount } = renderHook(() => useDebounce(1000));

        act(() => {
            result.current[1](callback);
        });

        unmount();

        await act(async () => {
            vi.advanceTimersByTime(1000);
            await flushMicrotasks();
        });

        expect(callback).not.toHaveBeenCalled();
    });

    it('keeps the loading state until an async callback settles', async () => {
        let resolveCallback: (() => void) | undefined;

        const { result } = renderHook(() => useDebounce(1000));

        act(() => {
            result.current[1](
                () =>
                    new Promise<void>((resolve) => {
                        resolveCallback = resolve;
                    }),
            );
        });

        await act(async () => {
            vi.advanceTimersByTime(1000);
            await flushMicrotasks();
        });

        expect(result.current[0]).toBe(true);

        await act(async () => {
            resolveCallback?.();
            await flushMicrotasks();
        });

        expect(result.current[0]).toBe(false);
    });

    it('recovers loading state when the callback throws', async () => {
        const { result } = renderHook(() => useDebounce(1000));

        act(() => {
            result.current[1](() => {
                throw new Error('boom');
            });
        });

        await act(async () => {
            vi.advanceTimersByTime(1000);
            await flushMicrotasks();
        });

        expect(result.current[0]).toBe(false);
    });
});
