import { cva } from 'class-variance-authority';

export const textVariants = cva('', {
    variants: {
        variant: {
            display: 'text-display',
            heading: 'text-heading',
            subheading: 'text-subheading',
            body: 'text-body',
            meta: 'text-meta',
            label: 'text-label',
            micro: 'text-micro'
        },
        weight: {
            regular: 'font-normal',
            medium: 'font-medium',
            semibold: 'font-semibold',
            bold: 'font-bold'
        },
        tone: {
            default: 'text-fg-default',
            secondary: 'text-fg-secondary',
            tertiary: 'text-fg-tertiary',
            muted: 'text-fg-muted',
            placeholder: 'text-fg-placeholder',
            error: 'text-fg-error',
            onFilled: 'text-fg-on-filled'
        },
        tracking: {
            normal: '',
            tight: 'tracking-[-0.01em]',
            tighter: 'tracking-[-0.02em]',
            wide: 'tracking-[0.08em]',
            wider: 'tracking-[0.12em]',
            widest: 'tracking-[0.16em]'
        },
        transform: {
            none: '',
            uppercase: 'uppercase'
        },
        truncate: {
            true: 'truncate',
            false: ''
        }
    },
    defaultVariants: {
        variant: 'body',
        weight: 'regular',
        tone: 'default',
        tracking: 'normal',
        transform: 'none',
        truncate: false
    }
});
