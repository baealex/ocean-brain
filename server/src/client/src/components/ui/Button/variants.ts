import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
    [
        'inline-flex',
        'items-center',
        'justify-center',
        'gap-2',
        'font-bold',
        'transition-all',
        'duration-200',
        'border-2',
        'border-border',
        'disabled:pointer-events-none',
        'disabled:opacity-50',
        'hover:shadow-sketchy',
        'active:translate-x-0.5',
        'active:translate-y-0.5',
        'active:shadow-none'
    ],
    {
        variants: {
            variant: {
                primary: [
                    'bg-cta',
                    'text-fg-default',
                    'hover:bg-cta-hover'
                ],
                ghost: [
                    'border-transparent',
                    'hover:border-border',
                    'hover:bg-ghost'
                ],
                danger: [
                    'bg-accent-danger',
                    'text-fg-default',
                    'hover:bg-accent-danger-hover'
                ],
                'soft-success': [
                    'bg-accent-soft-success',
                    'text-fg-default',
                    'hover:bg-accent-soft-success-hover'
                ],
                'soft-danger': [
                    'bg-accent-soft-danger',
                    'text-fg-default',
                    'hover:bg-accent-soft-danger-hover'
                ]
            },
            size: {
                sm: 'h-8 px-3 text-sm rounded-[12px_4px_13px_3px/4px_10px_4px_12px]',
                md: 'h-10 px-4 text-sm rounded-[15px_4px_16px_4px/4px_12px_5px_14px]',
                lg: 'h-12 px-6 text-base rounded-[18px_5px_19px_5px/5px_14px_6px_16px]',
                icon: 'h-10 w-10 rounded-[12px_4px_13px_3px/4px_10px_4px_12px]',
                'icon-sm': 'h-8 w-8 rounded-[10px_3px_11px_3px/3px_8px_3px_10px]'
            }
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md'
        }
    }
);
