import { act, renderHook, waitFor } from '@testing-library/react';
import { useNoteWriteCoordinator } from './useNoteWriteCoordinator';

const createDeferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
};

describe('useNoteWriteCoordinator', () => {
    it('runs note writes sequentially in request order', async () => {
        const firstWrite = createDeferred<string>();
        const executionOrder: string[] = [];
        const { result } = renderHook(() => useNoteWriteCoordinator());

        const firstResult = result.current.execute(async () => {
            executionOrder.push('first:start');
            const value = await firstWrite.promise;
            executionOrder.push('first:end');
            return value;
        });
        const secondResult = result.current.execute(async () => {
            executionOrder.push('second:start');
            return 'second';
        });

        await Promise.resolve();
        expect(executionOrder).toEqual(['first:start']);

        firstWrite.resolve('first');

        await expect(firstResult).resolves.toBe('first');
        await expect(secondResult).resolves.toBe('second');
        expect(executionOrder).toEqual(['first:start', 'first:end', 'second:start']);
    });

    it('continues the queue after a failed write', async () => {
        const { result } = renderHook(() => useNoteWriteCoordinator());

        const failedResult = result.current.execute(async () => {
            throw new Error('write failed');
        });
        const recoveredResult = result.current.execute(async () => 'recovered');

        await expect(failedResult).rejects.toThrow('write failed');
        await expect(recoveredResult).resolves.toBe('recovered');
    });

    it('skips queued writes invalidated before they start', async () => {
        const firstWrite = createDeferred<void>();
        const queuedWrite = vi.fn().mockResolvedValue('stale');
        const { result } = renderHook(() => useNoteWriteCoordinator());

        const firstResult = result.current.execute(() => firstWrite.promise);
        const queuedResult = result.current.execute(queuedWrite);

        await Promise.resolve();
        result.current.invalidatePending();
        firstWrite.resolve();

        await expect(firstResult).resolves.toBeUndefined();
        await expect(queuedResult).resolves.toBeUndefined();
        expect(queuedWrite).not.toHaveBeenCalled();
    });

    it('drains the active transaction before resolving', async () => {
        const transaction = createDeferred<void>();
        const { result } = renderHook(() => useNoteWriteCoordinator());
        let didDrain = false;

        void result.current.execute(() => transaction.promise);
        const drainResult = result.current.drain().then(() => {
            didDrain = true;
        });

        await Promise.resolve();
        expect(didDrain).toBe(false);

        transaction.resolve();
        await drainResult;

        expect(didDrain).toBe(true);
    });

    it('reports queued and active transactions as busy', async () => {
        const transaction = createDeferred<void>();
        const { result } = renderHook(() => useNoteWriteCoordinator());

        let transactionResult!: Promise<void | undefined>;
        act(() => {
            transactionResult = result.current.execute(() => transaction.promise);
        });

        expect(result.current.isBusy).toBe(true);
        expect(result.current.hasPendingWrites()).toBe(true);

        await act(async () => {
            transaction.resolve();
            await transactionResult;
        });

        await waitFor(() => expect(result.current.isBusy).toBe(false));
        expect(result.current.hasPendingWrites()).toBe(false);
    });
});
