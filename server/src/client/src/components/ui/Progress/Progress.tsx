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
                    'rounded-[6px_2px_7px_2px/2px_5px_2px_6px]',
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
