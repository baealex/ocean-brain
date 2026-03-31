import { forwardRef } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

const textareaVariants = cva(
    [
        'w-full',
        'border',
        'border-border-subtle',
        'bg-elevated',
        'text-fg-default',
        'placeholder:text-fg-placeholder',
        'transition-colors',
        'outline-none',
        'focus-ring-soft',
        'disabled:cursor-not-allowed',
        'disabled:opacity-50',
        'resize-none'
    ],
    {
        variants: {
            variant: {
                default: [],
                ghost: [
                    'border-transparent',
                    'bg-subtle',
                    'hover:bg-hover-subtle'
                ],
                error: [
                    'border-border-error',
                    'bg-accent-soft-danger/40',
                    'text-fg-default'
                ]
            },
            size: {
                sm: 'min-h-[60px] p-3 text-sm rounded-[14px]',
                md: 'min-h-[80px] p-3 text-sm rounded-[16px]',
                lg: 'min-h-[100px] p-4 text-base rounded-[18px]'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'md'
        }
    }
);

export interface TextareaProps
    extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
        VariantProps<typeof textareaVariants> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    (
        {
            className,
            variant,
            size,
            ...props
        },
        ref
    ) => {
        return (
            <textarea
                ref={ref}
                className={textareaVariants({
                    variant,
                    size,
                    className
                })}
                {...props}
            />
        );
    }
);

Textarea.displayName = 'Textarea';
