import { useEffect, useRef } from 'react';

import { useTheme } from '~/store/theme';

interface ImageProps {
    src: string;
    alt?: string;
    loading?: 'lazy' | 'eager';
    className?: string;
}

export default function Image({
    src,
    alt,
    loading = 'lazy',
    className
}: ImageProps) {
    const ref = useRef<HTMLImageElement>(null);
    const { theme } = useTheme(state => state);
    const isDark = theme === 'dark';

    const darkFilter = isDark ? 'brightness(0.85) saturate(0.9)' : undefined;

    useEffect(() => {
        if (!ref.current || loading !== 'lazy' || !src) {
            return;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                const img = entry.target as HTMLImageElement;
                img.src = img.dataset.src as string;
                observer.unobserve(img);
            }
        });

        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, [loading, src]);

    return (
        <>
            {loading !== 'lazy' ? (
                <img src={src} alt={alt} className={className} style={{ filter: darkFilter }} />
            ) : (
                <img
                    ref={ref}
                    src={'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2O4evXqfwAIgQN/QHwrfwAAAABJRU5ErkJggg=='}
                    alt={alt}
                    data-src={src}
                    className={className}
                    style={{ filter: darkFilter }}
                />
            )}
        </>
    );
}
