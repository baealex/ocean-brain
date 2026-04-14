import classNames from 'classnames';
import { forwardRef } from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    width?: string | number;
    height?: string | number;
    opacity?: number;
}

const resolveDimension = (value?: string | number) => {
    if (typeof value === 'number') {
        return `${value}px`;
    }

    return value;
};

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
    ({ width, height = 30, opacity, className = '', style, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={classNames(
                    'rounded-[14px]',
                    'skeleton-sized',
                    'bg-[length:200%_100%]',
                    'bg-gradient-to-r',
                    'from-pastel-lavender-200/30',
                    'via-pastel-yellow-200/20',
                    'to-pastel-lavender-200/30',
                    'animate-shimmer',
                    'animate-fade-in',
                    className,
                )}
                style={
                    {
                        '--skeleton-width': resolveDimension(width),
                        '--skeleton-height': resolveDimension(height),
                        '--skeleton-opacity': opacity,
                        ...style,
                    } as React.CSSProperties
                }
                {...props}
            />
        );
    },
);

Skeleton.displayName = 'Skeleton';

export default Skeleton;
