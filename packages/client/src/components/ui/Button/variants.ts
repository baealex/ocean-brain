import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
    [
        'inline-flex',
        'items-center',
        'justify-center',
        'gap-2',
        'whitespace-nowrap',
        'select-none',
        'font-medium',
        'transition-colors',
        'duration-200',
        'theme-control-frame',
        'focus-ring-soft',
        'outline-none',
        'disabled:pointer-events-none',
        'disabled:opacity-50',
    ],
    {
        variants: {
            variant: {
                primary: [
                    'bg-cta',
                    'border-transparent',
                    'text-fg-on-filled',
                    'hover:bg-cta-hover',
                    'active:bg-cta-hover',
                ],
                signature: [
                    'bg-accent-secondary',
                    'border-transparent',
                    'text-fg-on-accent',
                    'hover:bg-accent-secondary-hover',
                    'active:bg-accent-secondary-hover',
                ],
                subtle: [
                    'bg-transparent',
                    'border-border',
                    'text-fg-default',
                    'hover:bg-hover-subtle',
                    'hover:border-border-secondary',
                    'active:bg-hover',
                ],
                ghost: [
                    'border-transparent',
                    'bg-transparent',
                    'text-fg-secondary',
                    'hover:bg-hover-subtle',
                    'hover:border-border-subtle',
                    'hover:text-fg-default',
                    'active:bg-hover',
                ],
                danger: [
                    'bg-accent-danger',
                    'border-transparent',
                    'text-fg-on-filled',
                    'hover:bg-accent-danger-hover',
                    'active:bg-accent-danger-hover',
                ],
                'soft-success': [
                    'bg-accent-soft-success',
                    'border-transparent',
                    'text-accent-success',
                    'hover:bg-accent-soft-success-hover',
                    'active:bg-accent-soft-success-hover',
                ],
                'soft-danger': [
                    'bg-accent-soft-danger',
                    'border-transparent',
                    'text-fg-error',
                    'hover:bg-accent-soft-danger-hover',
                    'active:bg-accent-soft-danger-hover',
                ],
            },
            size: {
                sm: 'theme-radius-control-sm h-8 px-3 text-sm',
                md: 'theme-radius-control-md h-9 px-4 text-sm',
                lg: 'theme-radius-control-lg h-11 px-5 text-body',
                icon: 'theme-radius-control-md h-9 w-9',
                'icon-sm': 'theme-radius-control-sm h-8 w-8',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    },
);
