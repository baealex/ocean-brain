import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef } from 'react';

const TooltipProvider = TooltipPrimitive.Provider;

const TooltipRoot = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = forwardRef<
    React.ComponentRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(
    (
        {
            className,
            sideOffset = 4,
            ...props
        },
        ref
    ) => (
        <TooltipPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            className={[
                'z-50',
                'overflow-hidden',
                'px-3',
                'py-1.5',
                'text-xs',
                'font-bold',
                'bg-pastel-yellow-200',
                'dark:bg-zinc-700',
                'text-zinc-800',
                'dark:text-zinc-200',
                'border-2',
                'border-zinc-800',
                'dark:border-zinc-600',
                'rounded-[8px_3px_9px_2px/3px_6px_3px_7px]',
                'shadow-sketchy',
                'animate-in',
                'fade-in-0',
                'zoom-in-95',
                'data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0',
                'data-[state=closed]:zoom-out-95',
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
    )
);
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    side?: 'top' | 'right' | 'bottom' | 'left';
    delayDuration?: number;
}

export const Tooltip = ({
    content,
    children,
    side = 'top',
    delayDuration = 200
}: TooltipProps) => (
    <TooltipProvider>
        <TooltipRoot delayDuration={delayDuration}>
            <TooltipTrigger asChild>
                {children}
            </TooltipTrigger>
            <TooltipPrimitive.Portal>
                <TooltipContent side={side}>
                    {content}
                </TooltipContent>
            </TooltipPrimitive.Portal>
        </TooltipRoot>
    </TooltipProvider>
);

export {
    TooltipProvider,
    TooltipRoot,
    TooltipTrigger,
    TooltipContent
};
