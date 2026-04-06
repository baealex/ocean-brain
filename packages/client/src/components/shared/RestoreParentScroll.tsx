import { useEffect, useRef } from 'react';
import { useLocation } from '@tanstack/react-router';

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
    const pathname = useLocation({ select: (location) => location.pathname });

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current?.parentElement) {
            const { parentElement } = ref.current;

            const saveOrDelete = (scrollTop: number) => {
                if (scrollTop !== 0) {
                    memo.set(pathname, scrollTop);
                    return;
                }
                memo.delete(pathname);
            };

            const handleScroll = optimizeEvent(() => {
                if (ref.current) {
                    const { scrollTop } = parentElement;
                    saveOrDelete(scrollTop);
                }
            });

            const scrollTop = memo.get(pathname);
            if (scrollTop) {
                parentElement.scrollTop = scrollTop;
            }

            parentElement.addEventListener('scroll', handleScroll);

            return () => {
                parentElement.removeEventListener('scroll', handleScroll);
            };
        }
    }, [pathname]);

    return <div ref={ref} className="hidden" />;
}
