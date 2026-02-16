import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const optimizeEvent = (fn: () => void) => {
    let ticking = false;

    return () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                fn();
                ticking = false;
            });
            ticking = true;
        }
    };
};

const memo = new Map<string, number>();

export default function RestoreParentScroll() {
    const location = useLocation();

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current?.parentElement) {
            const { parentElement } = ref.current;

            const saveOrDelete = (scrollTop: number) => {
                if (scrollTop !== 0) {
                    memo.set(location.pathname, scrollTop);
                    return;
                }
                memo.delete(location.pathname);
            };

            const handleScroll = optimizeEvent(() => {
                if (ref.current) {
                    const { scrollTop } = parentElement;
                    saveOrDelete(scrollTop);
                }
            });

            const scrollTop = memo.get(location.pathname);
            if (scrollTop) {
                parentElement.scrollTop = scrollTop;
            }

            parentElement.addEventListener('scroll', handleScroll);

            return () => {
                parentElement.removeEventListener('scroll', handleScroll);
            };
        }
    }, [ref, location]);

    return <div ref={ref} style={{ display: 'none' }} />;
}
