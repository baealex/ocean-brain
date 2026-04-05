import { forwardRef } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { progressBarVariants } from './variants';

interface ProgressProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
        VariantProps<typeof progressBarVariants> {
    value: number;
    max: number;
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
    ({
        value, max, color, className = '', ...props
    }, ref) => {
        const percentage = Math.min(100, Math.max(0, (value / max) * 100));

        return (
            <div
                ref={ref}
                className={[
                    'w-full h-3',
                    'bg-surface',
                    'border-2 border-border',
                    'rounded-[6px]',
                    'overflow-hidden',
                    className
                ].join(' ')}
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={max}
                {...props}>
                <div
                    className={progressBarVariants({ color })}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        );
    }
);

Progress.displayName = 'Progress';

export default Progress;
