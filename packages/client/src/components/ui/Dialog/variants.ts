import { cva, type VariantProps } from 'class-variance-authority';

export const dialogContentVariants = cva(
    [
        'relative',
        'pointer-events-auto',
        'w-full',
        'max-h-[calc(100dvh-2rem)]',
        'overflow-y-auto',
        'theme-surface-frame',
        'border-border-subtle',
        'overscroll-contain',
        'data-[state=open]:animate-in',
        'data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0',
        'data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95',
        'data-[state=open]:zoom-in-95',
    ],
    {
        variants: {
            variant: {
                default: 'theme-dialog-default max-w-[640px] bg-elevated',
                compact: 'theme-dialog-compact max-w-[480px] bg-surface',
                form: 'theme-dialog-form max-w-[560px] bg-elevated',
                inspect: 'theme-dialog-inspect max-w-[640px] bg-elevated',
                confirm: 'theme-dialog-confirm max-w-[336px] bg-surface',
            },
        },
        defaultVariants: { variant: 'default' },
    },
);

export const dialogHeaderVariants = cva(['flex', 'items-center', 'justify-between'], {
    variants: {
        variant: {
            default: 'border-b border-border-subtle/70 px-4 py-3.5',
            compact: 'border-b border-border-subtle/60 px-4 py-3',
            form: 'border-b border-border-subtle/65 px-4 py-3 sm:px-5',
            inspect: 'border-b border-border-subtle/70 px-4 py-3.5 sm:px-5',
            confirm: 'px-4 pb-1 pt-4',
        },
    },
    defaultVariants: { variant: 'default' },
});

export const dialogBodyVariants = cva('', {
    variants: {
        variant: {
            default: 'px-4 py-5 sm:px-5',
            compact: 'px-4 py-4',
            form: 'px-4 py-4 sm:px-5 sm:py-5',
            inspect: 'px-4 py-4 sm:px-5 sm:py-5',
            confirm: 'space-y-1 px-5 pb-4 pt-5',
        },
    },
    defaultVariants: { variant: 'default' },
});

export const dialogFooterVariants = cva(['flex', 'items-center', 'justify-end'], {
    variants: {
        variant: {
            default: 'border-t border-border-subtle/70 px-4 py-3.5',
            compact: 'px-4 pb-4 pt-0',
            form: 'border-t border-border-subtle/65 px-4 py-3 sm:px-5',
            inspect: 'border-t border-border-subtle/70 px-4 py-3.5 sm:px-5',
            confirm: 'justify-end gap-2 px-5 pb-5 pt-0',
        },
    },
    defaultVariants: { variant: 'default' },
});

export const dialogCloseButtonVariants = cva(
    [
        'flex',
        'items-center',
        'justify-center',
        'text-fg-secondary',
        'transition-colors',
        'hover:bg-hover-subtle',
        'hover:text-fg-default',
        'focus-ring-soft',
    ],
    {
        variants: {
            variant: {
                default: 'theme-radius-control-md h-10 w-10',
                compact: 'theme-radius-control-sm h-9 w-9',
                form: 'theme-radius-control-sm h-9 w-9',
                inspect: 'theme-radius-control-md h-10 w-10',
                confirm: 'theme-radius-control-sm h-9 w-9',
            },
        },
        defaultVariants: { variant: 'default' },
    },
);

export const dialogTitleVariants = cva('text-fg-default font-semibold', {
    variants: {
        variant: {
            default: 'text-heading tracking-[-0.02em]',
            compact: 'text-subheading tracking-[-0.01em]',
            form: 'text-heading tracking-[-0.02em]',
            inspect: 'text-heading tracking-[-0.02em]',
            confirm: 'text-subheading tracking-[-0.01em]',
        },
    },
    defaultVariants: { variant: 'default' },
});

export const dialogDescriptionVariants = cva('text-fg-secondary', {
    variants: {
        variant: {
            default: 'text-meta',
            compact: 'text-meta',
            form: 'text-meta',
            inspect: 'text-meta',
            confirm: 'text-meta',
        },
    },
    defaultVariants: { variant: 'default' },
});

export type DialogVariant = NonNullable<VariantProps<typeof dialogContentVariants>['variant']>;
