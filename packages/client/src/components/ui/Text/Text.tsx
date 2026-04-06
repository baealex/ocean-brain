import type { HTMLAttributes, ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';

import { textVariants } from './variants';

type TextTag = 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'label' | 'small';

export interface TextProps
    extends HTMLAttributes<HTMLElement>,
        VariantProps<typeof textVariants> {
    as?: TextTag;
    children?: ReactNode;
}

export function Text({
    as = 'span',
    className,
    variant,
    weight,
    tone,
    tracking,
    transform,
    truncate,
    children,
    ...props
}: TextProps) {
    const Component = as;

    return (
        <Component
            className={textVariants({
                variant,
                weight,
                tone,
                tracking,
                transform,
                truncate,
                className
            })}
            {...props}>
            {children}
        </Component>
    );
}
