import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef } from 'react';

import * as Icon from '~/components/icon';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={[
            'fixed',
            'inset-0',
            'z-[1100]',
            'bg-overlay',
            'backdrop-blur-[2px]',
            'data-[state=open]:animate-in',
            'data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0',
            'data-[state=open]:fade-in-0',
            className
        ]
            .filter(Boolean)
            .join(' ')}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={[
                'fixed',
                'left-1/2',
                'top-1/2',
                'z-[1100]',
                '-translate-x-1/2',
                '-translate-y-1/2',
                'w-[calc(100vw-2rem)]',
                'max-w-[640px]',
                'max-h-[calc(100vh-2rem)]',
                'overflow-y-auto',
                'bg-white',
                'dark:bg-elevated',
                'border',
                'border-border-subtle',
                'shadow-[0_32px_80px_-32px_rgba(15,18,24,0.45)]',
                'overscroll-contain',
                'data-[state=open]:animate-in',
                'data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0',
                'data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95',
                'data-[state=open]:zoom-in-95',
                'rounded-[22px]',
                className
            ]
                .filter(Boolean)
                .join(' ')}
            {...props}>
            {children}
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

interface DialogHeaderProps {
    title: string;
    onClose?: () => void;
    className?: string;
}

const DialogHeader = ({ title, onClose, className }: DialogHeaderProps) => (
    <div
        className={[
            'flex',
            'items-center',
            'justify-between',
            'px-4',
            'py-3.5',
            'border-b',
            'border-border-subtle/80',
            'text-lg',
            'font-bold',
            className
        ]
            .filter(Boolean)
            .join(' ')}>
        <DialogPrimitive.Title className="text-lg font-semibold text-fg-default">
            {title}
        </DialogPrimitive.Title>
        {onClose && (
            <DialogClose asChild>
                <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-[14px] text-fg-secondary transition-colors hover:bg-hover-subtle hover:text-fg-default focus-ring-soft"
                    onClick={onClose}>
                    <Icon.Close className="w-5 h-5" />
                </button>
            </DialogClose>
        )}
    </div>
);
DialogHeader.displayName = 'DialogHeader';

const DialogBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={['px-4 py-5 sm:px-5', className].filter(Boolean).join(' ')}
            {...props}
        />
    )
);
DialogBody.displayName = 'DialogBody';

const DialogFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={[
                'flex',
                'items-center',
                'justify-end',
                'border-t',
                'border-border-subtle/80',
                'px-4',
                'py-3.5',
                className
            ]
                .filter(Boolean)
                .join(' ')}
            {...props}
        />
    )
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = DialogPrimitive.Title;

const DialogDescription = DialogPrimitive.Description;

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogTitle,
    DialogDescription
};
