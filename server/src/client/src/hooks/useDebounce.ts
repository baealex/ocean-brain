import { useRef, useState } from 'react';

const useDebounce = (delay: number) => {
    const [isMounted, setIsMounted] = useState(false);

    const ref = useRef<ReturnType<typeof setTimeout>>(null);

    return [
        isMounted,
        (fn: () => void) => {
            setIsMounted(true);
            if (ref.current) {
                clearTimeout(ref.current);
            }
            ref.current = setTimeout(() => {
                fn();
                setIsMounted(false);
            }, delay);
        }
    ] as const;
};

export default useDebounce;
