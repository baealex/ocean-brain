import { forwardRef } from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    width?: string | number;
    height?: string | number;
    opacity?: number;
}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
    ({
        width, height = 30, opacity, className = '', style, ...props
    }, ref) => {
        return (
            <div
                ref={ref}
                className={[
                    'rounded-[10px_3px_11px_3px/3px_8px_3px_10px]',
                    'border-2',
                    'border-divider',
                    'bg-[length:200%_100%]',
                    'bg-gradient-to-r',
                    'from-pastel-lavender-200/30',
                    'via-pastel-yellow-200/20',
                    'to-pastel-lavender-200/30',
                    'dark:from-zinc-800',
                    'dark:via-zinc-700',
                    'dark:to-zinc-800',
                    'animate-shimmer',
                    'animate-fade-in',
                    className
                ].join(' ')}
                style={{
                    width,
                    height,
                    opacity,
                    ...style
                }}
                {...props}
            />
        );
    }
);

Skeleton.displayName = 'Skeleton';

export default Skeleton;
