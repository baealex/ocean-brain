import { cva } from 'class-variance-authority';

export const inputVariants = cva(
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
        'disabled:opacity-50'
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
                sm: 'h-8 px-3 text-sm rounded-[12px]',
                md: 'h-9 px-3 text-sm rounded-[14px]',
                lg: 'h-11 px-4 text-base rounded-[16px]'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'md'
        }
    }
);
