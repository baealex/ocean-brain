import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const labelVariants = cva(
    [
        'font-bold',
        'text-fg-muted',
        'whitespace-nowrap'
    ],
    {
        variants: {
            size: {
                sm: 'text-xs',
                md: 'text-sm',
                lg: 'text-base'
            }
        },
        defaultVariants: { size: 'sm' }
    }
);

export interface LabelProps
    extends React.LabelHTMLAttributes<HTMLLabelElement>,
        VariantProps<typeof labelVariants> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
    (
        {
            className,
            size,
            ...props
        },
        ref
    ) => (
        <label
            ref={ref}
            className={labelVariants({
                size,
                className
            })}
            {...props}
        />
    )
);

Label.displayName = 'Label';
