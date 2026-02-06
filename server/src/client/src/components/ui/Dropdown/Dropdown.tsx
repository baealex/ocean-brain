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
            'rounded-sm',
            'px-2',
            'py-1.5',
            'text-sm',
            'outline-none',
            'focus:bg-zinc-100',
            'dark:focus:bg-zinc-800',
            'data-[state=open]:bg-zinc-100',
            'dark:data-[state=open]:bg-zinc-800',
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
            'rounded-md',
            'bg-white',
            'dark:bg-zinc-900',
            'p-1',
            'shadow-lg',
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
                'rounded-[10px_3px_11px_3px/3px_8px_3px_10px]',
                'bg-surface',
                'dark:bg-surface-dark',
                'border-2',
                'border-zinc-800',
                'dark:border-zinc-700',
                'shadow-sketchy',
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
            'font-bold',
            'text-zinc-700',
            'dark:text-zinc-300',
            'outline-none',
            'transition-colors',
            'rounded-[6px_2px_7px_2px/2px_5px_2px_6px]',
            'focus:bg-pastel-yellow-200',
            'focus:text-zinc-800',
            'dark:focus:bg-pastel-purple-200',
            'dark:focus:text-zinc-800',
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
            'rounded-sm',
            'py-1.5',
            'pl-8',
            'pr-2',
            'text-sm',
            'outline-none',
            'transition-colors',
            'focus:bg-zinc-100',
            'dark:focus:bg-zinc-800',
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
            'rounded-sm',
            'py-1.5',
            'pl-8',
            'pr-2',
            'text-sm',
            'outline-none',
            'transition-colors',
            'focus:bg-zinc-100',
            'dark:focus:bg-zinc-800',
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
            'bg-zinc-200',
            'dark:bg-zinc-700',
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
                <button type="button" className="flex items-center justify-center">
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
