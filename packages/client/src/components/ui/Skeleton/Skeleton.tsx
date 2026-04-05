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
                    'rounded-[14px]',
                    'bg-[length:200%_100%]',
                    'bg-gradient-to-r',
                    'from-pastel-lavender-200/30',
                    'via-pastel-yellow-200/20',
                    'to-pastel-lavender-200/30',
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
