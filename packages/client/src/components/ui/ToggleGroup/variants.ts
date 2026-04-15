import { cva } from 'class-variance-authority';

export const toggleGroupVariants = cva(['inline-flex', 'gap-0.5', 'overflow-hidden'], {
    variants: {
        variant: {
            default: ['border-2', 'border-border', 'rounded-[10px]', 'bg-surface'],
            outline: ['border-2', 'border-border', 'rounded-[10px]', 'bg-transparent'],
            pills: ['surface-base', 'p-1'],
            quiet: ['rounded-[12px]', 'border', 'border-border-subtle/80', 'bg-hover-subtle/55', 'p-0.5'],
        },
    },
    defaultVariants: { variant: 'default' },
});

export const toggleGroupItemVariants = cva(
    [
        'flex',
        'items-center',
        'justify-center',
        'font-bold',
        'border',
        'border-transparent',
        'transition-colors',
        'duration-200',
        'disabled:pointer-events-none',
        'disabled:opacity-50',
    ],
    {
        variants: {
            variant: {
                default: [
                    'text-fg-muted',
                    'hover:bg-hover',
                    'data-[state=on]:bg-cta',
                    'data-[state=on]:text-fg-on-filled',
                ],
                outline: [
                    'text-fg-muted',
                    'hover:bg-hover-subtle',
                    'data-[state=on]:bg-cta',
                    'data-[state=on]:text-fg-on-filled',
                ],
                pills: [
                    'text-fg-secondary',
                    'rounded-[10px]',
                    'hover:bg-hover-subtle',
                    'data-[state=on]:bg-cta',
                    'data-[state=on]:text-fg-on-filled',
                    'data-[state=on]:border-border-secondary',
                ],
                quiet: [
                    'rounded-[10px]',
                    'font-medium',
                    'text-fg-secondary',
                    'hover:bg-hover-subtle/80',
                    'data-[state=on]:border-border-secondary/70',
                    'data-[state=on]:bg-elevated',
                    'data-[state=on]:text-fg-default',
                    'data-[state=on]:shadow-[0_8px_18px_-16px_rgba(15,18,24,0.28)]',
                ],
            },
            size: {
                sm: 'px-2 py-1.5 text-xs',
                md: 'px-3 py-2 text-sm',
                lg: 'px-4 py-2.5 text-sm',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'md',
        },
    },
);
