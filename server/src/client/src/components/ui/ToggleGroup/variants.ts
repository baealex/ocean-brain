import { cva } from 'class-variance-authority';

export const toggleGroupVariants = cva(
    [
        'inline-flex',
        'gap-0.5',
        'overflow-hidden'
    ],
    {
        variants: {
            variant: {
                default: [
                    'border-2',
                    'border-zinc-800',
                    'dark:border-zinc-700',
                    'rounded-[12px_4px_13px_3px/4px_10px_4px_12px]',
                    'bg-surface',
                    'dark:bg-surface-dark'
                ],
                outline: [
                    'border-2',
                    'border-zinc-800',
                    'dark:border-zinc-700',
                    'rounded-[12px_4px_13px_3px/4px_10px_4px_12px]',
                    'bg-transparent'
                ],
                pills: [
                    'bg-pastel-lavender-200/30',
                    'dark:bg-zinc-800',
                    'rounded-[14px_4px_15px_4px/4px_12px_4px_14px]',
                    'p-1',
                    'border-2',
                    'border-zinc-800',
                    'dark:border-zinc-700'
                ]
            }
        },
        defaultVariants: { variant: 'default' }
    }
);

export const toggleGroupItemVariants = cva(
    [
        'flex',
        'items-center',
        'justify-center',
        'font-bold',
        'transition-all',
        'duration-200',
        'disabled:pointer-events-none',
        'disabled:opacity-50'
    ],
    {
        variants: {
            variant: {
                default: [
                    'text-zinc-700',
                    'dark:text-zinc-300',
                    'hover:bg-pastel-lavender-200/50',
                    'dark:hover:bg-zinc-700',
                    'data-[state=on]:bg-pastel-yellow-200',
                    'data-[state=on]:dark:bg-zinc-700',
                    'data-[state=on]:text-zinc-800',
                    'data-[state=on]:dark:text-zinc-200',
                    'data-[state=on]:shadow-sketchy'
                ],
                outline: [
                    'text-zinc-700',
                    'dark:text-zinc-300',
                    'hover:bg-pastel-lavender-200/30',
                    'dark:hover:bg-zinc-800',
                    'data-[state=on]:bg-pastel-blue-200',
                    'data-[state=on]:text-zinc-800'
                ],
                pills: [
                    'text-zinc-600',
                    'dark:text-zinc-400',
                    'rounded-[10px_3px_11px_3px/3px_8px_3px_10px]',
                    'data-[state=on]:bg-pastel-yellow-200',
                    'data-[state=on]:dark:bg-zinc-700',
                    'data-[state=on]:text-zinc-800',
                    'data-[state=on]:dark:text-zinc-200',
                    'data-[state=on]:shadow-sketchy',
                    'data-[state=on]:border-2',
                    'data-[state=on]:border-zinc-800',
                    'data-[state=on]:dark:border-zinc-600'
                ]
            },
            size: {
                sm: 'px-2 py-1.5 text-xs',
                md: 'px-3 py-2 text-sm',
                lg: 'px-4 py-2.5 text-sm'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'md'
        }
    }
);
