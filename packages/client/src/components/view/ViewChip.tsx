import classNames from 'classnames';
import type { HTMLAttributes, ReactNode } from 'react';

type ViewChipSize = 'compact' | 'regular';

interface ViewChipProps extends HTMLAttributes<HTMLSpanElement> {
    children: ReactNode;
    contentClassName?: string;
    size?: ViewChipSize;
    truncateContent?: boolean;
}

const sizeClassNames: Record<ViewChipSize, string> = {
    compact: 'h-[22px] px-2',
    regular: 'h-7 px-2.5',
};

export default function ViewChip({
    children,
    className,
    contentClassName,
    size = 'regular',
    truncateContent = true,
    ...props
}: ViewChipProps) {
    return (
        <span
            className={classNames(
                'inline-flex min-w-0 items-center overflow-hidden whitespace-nowrap rounded-full border text-xs font-medium leading-none',
                sizeClassNames[size],
                className,
            )}
            {...props}
        >
            {truncateContent ? (
                <span className={classNames('min-w-0 truncate', contentClassName)}>{children}</span>
            ) : (
                children
            )}
        </span>
    );
}
