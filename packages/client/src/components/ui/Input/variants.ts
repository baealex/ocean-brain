import { cva } from 'class-variance-authority';

export const inputVariants = cva(
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
    ],
    {
        variants: {
            variant: {
                default: [],
                ghost: ['border-transparent', 'bg-subtle', 'hover:bg-hover-subtle'],
                error: ['border-border-error', 'bg-accent-soft-danger/40', 'text-fg-default'],
            },
            size: {
                sm: 'theme-radius-control-sm h-8 px-3 text-sm',
                md: 'theme-radius-control-md h-9 px-3 text-sm',
                lg: 'theme-radius-control-lg h-11 px-4 text-base',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'md',
        },
    },
);
