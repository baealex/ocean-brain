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
            'bg-black/50',
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
                'w-full',
                'max-w-[640px]',
                'bg-surface',
                'dark:bg-surface-dark',
                'border-2',
                'border-zinc-800',
                'dark:border-zinc-700',
                'shadow-sketchy-lg',
                'data-[state=open]:animate-in',
                'data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0',
                'data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95',
                'data-[state=open]:zoom-in-95',
                'mx-4',
                'rounded-[24px_8px_25px_7px/8px_20px_8px_22px]',
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
            'p-4',
            'text-lg',
            'font-bold',
            className
        ]
            .filter(Boolean)
            .join(' ')}>
        <DialogPrimitive.Title className="text-lg font-bold">
            {title}
        </DialogPrimitive.Title>
        {onClose && (
            <DialogClose asChild>
                <button
                    type="button"
                    className="w-11 h-11 flex items-center justify-center cursor-pointer hover:bg-pastel-pink-200/50 rounded-[10px_3px_11px_3px/3px_8px_3px_10px] transition-colors"
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
            className={['p-4', className].filter(Boolean).join(' ')}
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
                'p-4',
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
