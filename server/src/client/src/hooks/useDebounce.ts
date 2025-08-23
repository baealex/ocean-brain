import { useCallback, useRef, useState } from 'react';

const useDebounce = (delay: number) => {
    const [isMounted, setIsMounted] = useState(false);

    const ref = useRef<ReturnType<typeof setTimeout>>();

    const setEvent = useCallback((fn: () => void) => {
        setIsMounted(true);
        if (ref.current) {
            clearTimeout(ref.current);
        }
        ref.current = setTimeout(() => {
            fn();
            setIsMounted(false);
        }, delay);
    }, [delay]);

    return [
        isMounted,
        setEvent
    ] as const;
};

export default useDebounce;
