import { cva } from 'class-variance-authority';

import * as Icon from '~/components/icon';

const moreButtonVariants = cva(
    [
        'focus-ring-soft',
        'inline-flex',
        'shrink-0',
        'items-center',
        'justify-center',
        'bg-transparent',
        'text-fg-default/70',
        'outline-none',
        'transition-colors',
        'hover:bg-hover-subtle',
        'hover:text-fg-default',
    ],
    {
        variants: {
            size: {
                sm: 'h-7 w-7 rounded-[8px]',
                md: 'h-8 w-8 rounded-[10px]',
                lg: 'h-9 w-9 rounded-[12px]',
            },
        },
        defaultVariants: {
            size: 'md',
        },
    },
);

const iconSizeClassNameBySize = {
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
} as const;

interface MoreButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    label: string;
    size?: keyof typeof iconSizeClassNameBySize;
    iconClassName?: string;
}

export function MoreButton({
    label,
    size = 'md',
    iconClassName,
    className,
    type = 'button',
    ...props
}: MoreButtonProps) {
    return (
        <button type={type} aria-label={label} className={moreButtonVariants({ size, className })} {...props}>
            <Icon.VerticalDots className={iconClassName ?? iconSizeClassNameBySize[size]} />
        </button>
    );
}

export { moreButtonVariants };
