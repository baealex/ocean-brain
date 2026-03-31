import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { forwardRef } from 'react';

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
        inset?: boolean;
    }
>(({ className, inset, children, ...props }, ref) => (
    <DropdownMenuPrimitive.SubTrigger
        ref={ref}
        className={[
            'flex',
            'cursor-default',
            'select-none',
            'items-center',
            'rounded-[12px]',
            'px-3',
            'py-2',
            'text-sm',
            'font-medium',
            'text-fg-secondary',
            'outline-none',
            'focus-ring-soft',
            'focus:bg-hover-subtle',
            'focus:text-fg-default',
            'data-[state=open]:bg-hover-subtle',
            'data-[state=open]:text-fg-default',
            inset && 'pl-8',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        {...props}>
        {children}
    </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.SubContent
        ref={ref}
        className={[
            'z-50',
            'min-w-[8rem]',
            'overflow-hidden',
            'surface-floating',
            'rounded-[18px]',
            'border',
            'border-border-subtle',
            'p-1',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        {...props}
    />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            className={[
                'z-[1100]',
                'min-w-[10rem]',
                'overflow-hidden',
                'surface-floating',
                'rounded-[18px]',
                'border',
                'border-border-subtle',
                'p-1',
                'data-[state=open]:animate-in',
                'data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0',
                'data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95',
                'data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2',
                'data-[side=left]:slide-in-from-right-2',
                'data-[side=right]:slide-in-from-left-2',
                'data-[side=top]:slide-in-from-bottom-2',
                className
            ]
                .filter(Boolean)
                .join(' ')}
            {...props}
        />
    </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
        inset?: boolean;
    }
>(({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
        ref={ref}
        className={[
            'relative',
            'flex',
            'cursor-pointer',
            'select-none',
            'items-center',
            'px-3',
            'py-2',
            'text-sm',
            'font-medium',
            'text-fg-secondary',
            'outline-none',
            'focus-ring-soft',
            'transition-colors',
            'rounded-[12px]',
            'focus:bg-hover-subtle',
            'focus:text-fg-default',
            'data-[disabled]:pointer-events-none',
            'data-[disabled]:opacity-50',
            inset && 'pl-8',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        {...props}
    />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
    <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        className={[
            'relative',
            'flex',
            'cursor-pointer',
            'select-none',
            'items-center',
            'rounded-[12px]',
            'py-2',
            'pl-8',
            'pr-3',
            'text-sm',
            'font-medium',
            'text-fg-secondary',
            'outline-none',
            'focus-ring-soft',
            'transition-colors',
            'focus:bg-hover-subtle',
            'focus:text-fg-default',
            'data-[disabled]:pointer-events-none',
            'data-[disabled]:opacity-50',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        checked={checked}
        {...props}>
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <DropdownMenuPrimitive.ItemIndicator>
                ✓
            </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
    </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitive.RadioItem
        ref={ref}
        className={[
            'relative',
            'flex',
            'cursor-pointer',
            'select-none',
            'items-center',
            'rounded-[12px]',
            'py-2',
            'pl-8',
            'pr-3',
            'text-sm',
            'font-medium',
            'text-fg-secondary',
            'outline-none',
            'focus-ring-soft',
            'transition-colors',
            'focus:bg-hover-subtle',
            'focus:text-fg-default',
            'data-[disabled]:pointer-events-none',
            'data-[disabled]:opacity-50',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        {...props}>
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <DropdownMenuPrimitive.ItemIndicator>
                ●
            </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
    </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
        inset?: boolean;
    }
>(({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Label
        ref={ref}
        className={[
            'px-2',
            'py-1.5',
            'text-sm',
            'font-semibold',
            'text-fg-secondary',
            inset && 'pl-8',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        {...props}
    />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
    <DropdownMenuPrimitive.Separator
        ref={ref}
        className={[
            '-mx-1',
            'my-1',
            'h-px',
            'bg-divider',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        {...props}
    />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
    return (
        <span
            className={[
                'ml-auto',
                'text-xs',
                'tracking-widest',
                'opacity-60',
                className
            ]
                .filter(Boolean)
                .join(' ')}
            {...props}
        />
    );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

interface DropdownProps {
    button: React.ReactNode;
    items: {
        name: string;
        onClick: () => void;
    }[];
}

const Dropdown = ({ button, items }: DropdownProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="surface-base focus-ring-soft inline-flex items-center justify-center rounded-[16px] border border-border-subtle bg-elevated px-3 py-2 text-sm font-medium text-fg-default transition-colors hover:bg-hover-subtle">
                    {button}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {items.map(item => (
                    <DropdownMenuItem key={item.name} onClick={item.onClick}>
                        {item.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export {
    Dropdown,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuGroup,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuRadioGroup
};
