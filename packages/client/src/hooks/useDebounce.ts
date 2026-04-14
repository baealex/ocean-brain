import { useCallback, useEffect, useRef, useState } from 'react';

type DebouncedEvent = () => void | Promise<void>;

const useDebounce = (delay: number) => {
    const [isMounted, setIsMounted] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    const invocationIdRef = useRef(0);

    const clearPendingTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
            clearPendingTimer();
        };
    }, [clearPendingTimer]);

    const setEvent = useCallback(
        (fn: DebouncedEvent) => {
            invocationIdRef.current += 1;
            const invocationId = invocationIdRef.current;

            clearPendingTimer();

            if (mountedRef.current) {
                setIsMounted(true);
            }

            timerRef.current = setTimeout(() => {
                timerRef.current = null;

                void Promise.resolve()
                    .then(fn)
                    .catch(() => undefined)
                    .finally(() => {
                        if (!mountedRef.current) {
                            return;
                        }

                        if (invocationIdRef.current !== invocationId) {
                            return;
                        }

                        setIsMounted(false);
                    });
            }, delay);
        },
        [clearPendingTimer, delay],
    );

    return [isMounted, setEvent] as const;
};

export default useDebounce;
