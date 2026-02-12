import { cva } from 'class-variance-authority';

export const inputVariants = cva(
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
        'disabled:opacity-50'
    ],
    {
        variants: {
            variant: {
                default: [],
                ghost: [
                    'border-transparent',
                    'bg-subtle',
                    'focus:border-border-focus',
                ],
                error: [
                    'border-border-error',
                    'bg-pastel-pink-200/20',
                    'focus:border-red-500'
                ]
            },
            size: {
                sm: 'h-8 px-2 text-sm rounded-[8px_3px_9px_2px/3px_7px_3px_8px]',
                md: 'h-10 px-3 text-sm rounded-[10px_3px_11px_3px/3px_9px_3px_10px]',
                lg: 'h-12 px-4 text-base rounded-[12px_4px_13px_3px/4px_10px_4px_12px]'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'md'
        }
    }
);
