import * as DialogPrimitive from '@radix-ui/react-dialog';
import { createContext, forwardRef, useContext } from 'react';
import classNames from 'classnames';

import * as Icon from '~/components/icon';
import {
    dialogBodyVariants,
    dialogCloseButtonVariants,
    dialogContentVariants,
    dialogDescriptionVariants,
    dialogFooterVariants,
    dialogHeaderVariants,
    dialogTitleVariants,
    type DialogVariant
} from './variants';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogVariantContext = createContext<DialogVariant>('default');

const useDialogVariant = () => useContext(DialogVariantContext);

const DialogOverlay = forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={classNames(
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
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
        variant?: DialogVariant;
    }
>(({ className, children, variant = 'default', ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            data-dialog-variant={variant}
            className={dialogContentVariants({
                variant,
                className
            })}
            {...props}>
            <DialogVariantContext.Provider value={variant}>
                {children}
            </DialogVariantContext.Provider>
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

interface DialogHeaderProps {
    title: string;
    onClose?: () => void;
    className?: string;
}

const DialogHeader = ({ title, onClose, className }: DialogHeaderProps) => {
    const variant = useDialogVariant();

    return (
        <div
            className={dialogHeaderVariants({
                variant,
                className
            })}>
            <DialogTitle>
                {title}
            </DialogTitle>
            {onClose && (
                <DialogClose asChild>
                    <button
                        type="button"
                        className={dialogCloseButtonVariants({ variant })}
                        onClick={onClose}>
                        <Icon.Close className={variant === 'compact' || variant === 'form' || variant === 'confirm' ? 'h-[18px] w-[18px]' : 'h-5 w-5'} />
                    </button>
                </DialogClose>
            )}
        </div>
    );
};
DialogHeader.displayName = 'DialogHeader';

const DialogBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        const variant = useDialogVariant();

        return (
            <div
                ref={ref}
                className={dialogBodyVariants({
                    variant,
                    className
                })}
                {...props}
            />
        );
    }
);
DialogBody.displayName = 'DialogBody';

const DialogFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        const variant = useDialogVariant();

        return (
            <div
                ref={ref}
                className={dialogFooterVariants({
                    variant,
                    className
                })}
                {...props}
            />
        );
    }
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
    const variant = useDialogVariant();

    return (
        <DialogPrimitive.Title
            ref={ref}
            className={classNames(dialogTitleVariants({ variant }), className)}
            {...props}
        />
    );
});
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
    const variant = useDialogVariant();

    return (
        <DialogPrimitive.Description
            ref={ref}
            className={classNames(dialogDescriptionVariants({ variant }), className)}
            {...props}
        />
    );
});
DialogDescription.displayName = DialogPrimitive.Description.displayName;

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
