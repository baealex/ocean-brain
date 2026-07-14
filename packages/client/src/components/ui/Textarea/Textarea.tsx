import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { forwardRef } from 'react';

const textareaVariants = cva(
    [
        'w-full',
        'theme-control-frame',
        'border-border-subtle',
        'bg-elevated',
        'text-fg-default',
        'placeholder:text-fg-placeholder',
        'transition-colors',
        'outline-none',
        'focus-ring-soft',
        'disabled:cursor-not-allowed',
        'disabled:opacity-50',
        'resize-none',
    ],
    {
        variants: {
            variant: {
                default: [],
                ghost: ['border-transparent', 'bg-subtle', 'hover:bg-hover-subtle'],
                error: ['border-border-error', 'bg-accent-soft-danger/40', 'text-fg-default'],
            },
            size: {
                sm: 'theme-radius-control-sm min-h-[60px] p-3 text-sm',
                md: 'theme-radius-control-md min-h-[80px] p-3 text-sm',
                lg: 'theme-radius-control-lg min-h-[100px] p-4 text-base',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'md',
        },
    },
);

export interface TextareaProps
    extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
        VariantProps<typeof textareaVariants> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={textareaVariants({
                    variant,
                    size,
                    className,
                })}
                {...props}
            />
        );
    },
);

Textarea.displayName = 'Textarea';
