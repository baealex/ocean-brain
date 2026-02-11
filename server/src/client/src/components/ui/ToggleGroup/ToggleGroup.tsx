import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { forwardRef, createContext, useContext } from 'react';
import type { VariantProps } from 'class-variance-authority';

import { toggleGroupVariants, toggleGroupItemVariants } from './variants';

type ToggleGroupContextValue = {
    variant?: 'default' | 'outline' | 'pills';
    size?: 'sm' | 'md' | 'lg';
};

const ToggleGroupContext = createContext<ToggleGroupContextValue>({});

type ToggleGroupSingleProps = {
    type: 'single';
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
};

type ToggleGroupMultipleProps = {
    type: 'multiple';
    value?: string[];
    defaultValue?: string[];
    onValueChange?: (value: string[]) => void;
};

type ToggleGroupProps = (ToggleGroupSingleProps | ToggleGroupMultipleProps) &
    VariantProps<typeof toggleGroupVariants> & {
        size?: 'sm' | 'md' | 'lg';
        className?: string;
        children?: React.ReactNode;
        disabled?: boolean;
    };

export const ToggleGroup = forwardRef<HTMLDivElement, ToggleGroupProps>(
    (
        {
            className,
            variant,
            size,
            children,
            ...props
        },
        ref
    ) => (
        <ToggleGroupContext.Provider
            value={{
                variant: variant ?? 'default',
                size: size ?? 'md'
            }}>
            <ToggleGroupPrimitive.Root
                ref={ref}
                className={toggleGroupVariants({
                    variant,
                    className
                })}
                {...props}>
                {children}
            </ToggleGroupPrimitive.Root>
        </ToggleGroupContext.Provider>
    )
);
ToggleGroup.displayName = 'ToggleGroup';

interface ToggleGroupItemProps
    extends React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> {
    activeClassName?: string;
}

export const ToggleGroupItem = forwardRef<
    React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
    ToggleGroupItemProps
>(
    (
        {
            className,
            activeClassName,
            children,
            ...props
        },
        ref
    ) => {
        const context = useContext(ToggleGroupContext);

        return (
            <ToggleGroupPrimitive.Item
                ref={ref}
                className={toggleGroupItemVariants({
                    variant: context.variant,
                    size: context.size,
                    className: [className, activeClassName].filter(Boolean).join(' ')
                })}
                {...props}>
                {children}
            </ToggleGroupPrimitive.Item>
        );
    }
);
ToggleGroupItem.displayName = 'ToggleGroupItem';
