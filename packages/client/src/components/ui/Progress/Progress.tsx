import type { VariantProps } from 'class-variance-authority';
import classNames from 'classnames';
import { forwardRef } from 'react';
import { progressBarVariants } from './variants';

interface ProgressProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
        VariantProps<typeof progressBarVariants> {
    value: number;
    max: number;
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(({ value, max, color, className = '', ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div
            ref={ref}
            className={classNames(
                'w-full h-3',
                'bg-surface',
                'border-2 border-border',
                'rounded-[6px]',
                'overflow-hidden',
                className,
            )}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            {...props}
        >
            <div
                className={`progress-fill ${progressBarVariants({ color })}`}
                style={{ '--progress-width': `${percentage}%` } as React.CSSProperties}
            />
        </div>
    );
});

Progress.displayName = 'Progress';

export default Progress;
