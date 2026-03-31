import { forwardRef } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as Icon from '~/components/icon';

const selectTriggerVariants = cva(
    [
        'inline-flex',
        'items-center',
        'justify-between',
        'gap-2',
        'border',
        'border-border-subtle',
        'bg-elevated',
        'text-fg-default',
        'font-medium',
        'transition-colors',
        'outline-none',
        'focus-ring-soft',
        'disabled:cursor-not-allowed',
        'disabled:opacity-50',
        'cursor-pointer',
        'whitespace-nowrap'
    ],
    {
        variants: {
            variant: {
                default: [
                    'border-border-subtle'
                ],
                ghost: [
                    'border-transparent',
                    'bg-subtle',
                    'hover:bg-hover-subtle'
                ]
            },
            size: {
                sm: 'h-8 px-3 text-sm rounded-[14px]',
                md: 'h-10 px-3 text-sm rounded-[16px]',
                lg: 'h-12 px-4 text-base rounded-[18px]'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'md'
        }
    }
);

export interface SelectProps extends VariantProps<typeof selectTriggerVariants> {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
    children: React.ReactNode;
    disabled?: boolean;
}

const Select = ({
    value,
    defaultValue,
    onValueChange,
    placeholder,
    variant,
    size,
    className,
    children,
    disabled
}: SelectProps) => {
    return (
        <SelectPrimitive.Root
            value={value}
            defaultValue={defaultValue}
            onValueChange={onValueChange}
            disabled={disabled}>
            <SelectPrimitive.Trigger
                className={selectTriggerVariants({
                    variant,
                    size,
                    className
                })}>
                <SelectPrimitive.Value placeholder={placeholder} />
                <SelectPrimitive.Icon>
                    <Icon.ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
                <SelectContent>
                    <SelectPrimitive.Viewport className="p-1">
                        {children}
                    </SelectPrimitive.Viewport>
                </SelectContent>
            </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
    );
};

const SelectContent = forwardRef<
    React.ComponentRef<typeof SelectPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <SelectPrimitive.Content
        ref={ref}
        position="popper"
        sideOffset={4}
        className={[
            'z-[1100]',
            'min-w-[var(--radix-select-trigger-width)]',
            'overflow-hidden',
            'surface-floating',
            'rounded-[20px]',
            'border',
            'border-border-subtle',
            'p-1',
            'data-[state=open]:animate-fade-in',
            'data-[state=open]:animate-zoom-in',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        {...props}>
        {children}
    </SelectPrimitive.Content>
));
SelectContent.displayName = 'SelectContent';

const SelectItem = forwardRef<
    React.ComponentRef<typeof SelectPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
        ref={ref}
        className={[
            'relative',
            'flex',
            'items-center',
            'cursor-pointer',
            'select-none',
            'px-3',
            'py-2',
            'text-sm',
            'font-medium',
            'text-fg-secondary',
            'outline-none',
            'transition-colors',
            'rounded-[14px]',
            'data-[highlighted]:bg-hover-subtle',
            'data-[highlighted]:text-fg-default',
            'data-[disabled]:pointer-events-none',
            'data-[disabled]:opacity-50',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        {...props}>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

Select.displayName = 'Select';

export { Select, SelectItem };
