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
                    'border-border',
                    'rounded-[12px_4px_13px_3px/4px_10px_4px_12px]',
                    'bg-surface',
                ],
                outline: [
                    'border-2',
                    'border-border',
                    'rounded-[12px_4px_13px_3px/4px_10px_4px_12px]',
                    'bg-transparent'
                ],
                pills: [
                    'bg-subtle',
                    'rounded-[14px_4px_15px_4px/4px_12px_4px_14px]',
                    'p-1',
                    'border-2',
                    'border-border',
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
                    'text-fg-muted',
                    'hover:bg-hover',
                    'data-[state=on]:bg-elevated',
                    'data-[state=on]:text-fg-default',
                    'data-[state=on]:shadow-sketchy'
                ],
                outline: [
                    'text-fg-muted',
                    'hover:bg-hover-subtle',
                    'data-[state=on]:bg-accent-secondary',
                    'data-[state=on]:text-fg-default'
                ],
                pills: [
                    'text-fg-secondary',
                    'rounded-[10px_3px_11px_3px/3px_8px_3px_10px]',
                    'data-[state=on]:bg-elevated',
                    'data-[state=on]:text-fg-default',
                    'data-[state=on]:shadow-sketchy',
                    'data-[state=on]:border-2',
                    'data-[state=on]:border-border-secondary',
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
