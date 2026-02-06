import { cva } from 'class-variance-authority';

export const inputVariants = cva(
    [
        'w-full',
        'border-2',
        'border-zinc-800',
        'dark:border-zinc-700',
        'bg-surface',
        'dark:bg-surface-dark',
        'text-zinc-900',
        'dark:text-zinc-100',
        'placeholder:text-zinc-400',
        'dark:placeholder:text-zinc-500',
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
                    'bg-pastel-lavender-200/30',
                    'focus:border-zinc-800',
                    'dark:focus:border-zinc-400'
                ],
                error: [
                    'border-red-400',
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
