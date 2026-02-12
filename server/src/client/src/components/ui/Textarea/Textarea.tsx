import { forwardRef } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

const textareaVariants = cva(
    [
        'w-full',
        'border-2',
        'border-border',
        'bg-surface',
        'text-fg',
        'placeholder:text-fg-placeholder',
        'transition-all',
        'focus:outline-none',
        'focus:shadow-sketchy',
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
                    'focus:border-border-focus'
                ],
                error: [
                    'border-border-error',
                    'bg-pastel-pink-200/20',
                    'focus:border-red-500'
                ]
            },
            size: {
                sm: 'p-2 text-sm rounded-[8px_3px_9px_2px/3px_7px_3px_8px] min-h-[60px]',
                md: 'p-3 text-sm rounded-[10px_3px_11px_3px/3px_9px_3px_10px] min-h-[80px]',
                lg: 'p-4 text-base rounded-[12px_4px_13px_3px/4px_10px_4px_12px] min-h-[100px]'
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
