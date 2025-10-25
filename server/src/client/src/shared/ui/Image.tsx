import { useEffect, useRef } from 'react';

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
                <img src={src} alt={alt} className={className} />
            ) : (
                <img
                    ref={ref}
                    src={'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2O4evXqfwAIgQN/QHwrfwAAAABJRU5ErkJggg=='}
                    alt={alt}
                    data-src={src}
                    className={className}
                />
            )}
        </>
    );
}
