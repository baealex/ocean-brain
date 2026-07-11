import { useCallback, useMemo, useRef, useState } from 'react';

export type NoteWriteExecutor = <T>(write: () => Promise<T>) => Promise<T | undefined>;

export interface NoteWriteCoordinator {
    execute: NoteWriteExecutor;
    invalidatePending: () => void;
    drain: () => Promise<void>;
    isBusy: boolean;
    hasPendingWrites: () => boolean;
}

export function useNoteWriteCoordinator(): NoteWriteCoordinator {
    const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
    const generationRef = useRef(0);
    const pendingWriteCountRef = useRef(0);
    const [isBusy, setIsBusy] = useState(false);

    const execute = useCallback(<T>(write: () => Promise<T>) => {
        pendingWriteCountRef.current += 1;
        setIsBusy(true);
        const generation = generationRef.current;
        const runWrite = () => (generation === generationRef.current ? write() : undefined);
        const result = writeQueueRef.current.then(runWrite, runWrite);
        writeQueueRef.current = result.then(
            () => undefined,
            () => undefined,
        );
        const settleWrite = () => {
            pendingWriteCountRef.current -= 1;

            if (pendingWriteCountRef.current === 0) {
                setIsBusy(false);
            }
        };
        void result.then(settleWrite, settleWrite);

        return result;
    }, []);

    const invalidatePending = useCallback(() => {
        generationRef.current += 1;
    }, []);

    const drain = useCallback(() => writeQueueRef.current, []);
    const hasPendingWrites = useCallback(() => pendingWriteCountRef.current > 0, []);

    return useMemo(
        () => ({
            execute,
            invalidatePending,
            drain,
            isBusy,
            hasPendingWrites,
        }),
        [drain, execute, hasPendingWrites, invalidatePending, isBusy],
    );
}
