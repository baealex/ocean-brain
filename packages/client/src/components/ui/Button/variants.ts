import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
    [
        'inline-flex',
        'items-center',
        'justify-center',
        'gap-2',
        'font-medium',
        'text-fg-default',
        'transition-colors',
        'duration-200',
        'border',
        'border-border-subtle',
        'bg-elevated',
        'focus-ring-soft',
        'outline-none',
        'disabled:pointer-events-none',
        'disabled:opacity-50',
        'hover:bg-hover',
        'active:bg-active'
    ],
    {
        variants: {
            variant: {
                primary: [
                    'bg-cta',
                    'border-transparent',
                    'text-fg-on-filled',
                    'hover:bg-cta-hover'
                ],
                signature: [
                    'bg-accent-secondary',
                    'border-transparent',
                    'text-fg-on-filled',
                    'hover:bg-accent-secondary-hover'
                ],
                subtle: [
                    'bg-subtle',
                    'border-transparent',
                    'hover:bg-hover'
                ],
                ghost: [
                    'border-transparent',
                    'bg-transparent',
                    'hover:bg-hover-subtle'
                ],
                danger: [
                    'bg-accent-soft-danger',
                    'border-transparent',
                    'text-fg-default',
                    'hover:bg-accent-danger-hover'
                ],
                'soft-success': [
                    'bg-accent-soft-success',
                    'border-transparent',
                    'text-fg-default',
                    'hover:bg-accent-soft-success-hover'
                ],
                'soft-danger': [
                    'bg-accent-soft-danger',
                    'border-transparent',
                    'text-fg-default',
                    'hover:bg-accent-soft-danger-hover'
                ]
            },
            size: {
                sm: 'h-8 px-3 text-sm rounded-[16px]',
                md: 'h-10 px-4 text-sm rounded-[18px]',
                lg: 'h-12 px-6 text-base rounded-[20px]',
                icon: 'h-10 w-10 rounded-[18px]',
                'icon-sm': 'h-8 w-8 rounded-[16px]'
            }
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md'
        }
    }
);
