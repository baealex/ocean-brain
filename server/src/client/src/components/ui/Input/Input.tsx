import { forwardRef } from 'react';
import type { VariantProps } from 'class-variance-authority';

import { inputVariants } from './variants';

export interface InputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
        VariantProps<typeof inputVariants> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            variant,
            size,
            type = 'text',
            ...props
        },
        ref
    ) => {
        return (
            <input
                ref={ref}
                type={type}
                className={inputVariants({
                    variant,
                    size,
                    className
                })}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';
