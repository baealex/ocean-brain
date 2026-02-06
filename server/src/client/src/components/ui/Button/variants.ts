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
        'border-zinc-800',
        'dark:border-zinc-700',
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
                    'bg-pastel-yellow-200',
                    'dark:bg-zinc-700',
                    'text-zinc-800',
                    'dark:text-zinc-200',
                    'hover:bg-pastel-orange-200',
                    'dark:hover:bg-zinc-600'
                ],
                secondary: [
                    'bg-pastel-blue-200',
                    'dark:bg-zinc-700',
                    'text-zinc-800',
                    'dark:text-zinc-200',
                    'hover:bg-pastel-teal-200',
                    'dark:hover:bg-zinc-600'
                ],
                ghost: [
                    'border-transparent',
                    'hover:border-zinc-800',
                    'dark:hover:border-zinc-600',
                    'hover:bg-pastel-lavender-200',
                    'dark:hover:bg-zinc-800'
                ],
                danger: [
                    'bg-pastel-pink-200',
                    'dark:bg-zinc-700',
                    'text-zinc-800',
                    'dark:text-zinc-200',
                    'hover:bg-red-200',
                    'dark:hover:bg-zinc-600'
                ],
                success: [
                    'bg-pastel-green-200',
                    'dark:bg-zinc-700',
                    'text-zinc-800',
                    'dark:text-zinc-200',
                    'hover:bg-green-200',
                    'dark:hover:bg-zinc-600'
                ],
                'soft-success': [
                    'bg-pastel-green-200/50',
                    'dark:bg-zinc-800',
                    'text-zinc-800',
                    'dark:text-zinc-200',
                    'hover:bg-pastel-green-200',
                    'dark:hover:bg-zinc-700'
                ],
                'soft-danger': [
                    'bg-pastel-pink-200/50',
                    'dark:bg-zinc-800',
                    'text-zinc-800',
                    'dark:text-zinc-200',
                    'hover:bg-pastel-pink-200',
                    'dark:hover:bg-zinc-700'
                ],
                gradient: [
                    'bg-gradient-to-r',
                    'from-pastel-pink-200',
                    'to-pastel-orange-200',
                    'text-zinc-800',
                    'dark:from-zinc-700',
                    'dark:to-zinc-600',
                    'dark:text-zinc-200',
                    'hover:from-pastel-orange-200',
                    'hover:to-pastel-yellow-200'
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
