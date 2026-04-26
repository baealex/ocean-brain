import {
    type AlertComponentProps,
    ModalProvider as BaseModalProvider,
    type ConfirmComponentProps,
} from '@baejino/react-ui/modal';
import * as AlertDialogPrimitive from '@baejino/react-ui/modal/alert-dialog';
import classNames from 'classnames';

import { Button } from '../Button';
import {
    dialogBodyVariants,
    dialogContentVariants,
    dialogDescriptionVariants,
    dialogFooterVariants,
    dialogTitleVariants,
} from '../Dialog/variants';
import { Text } from '../Text';

const alertDialogOverlayClassName = classNames(
    'fixed',
    'inset-0',
    'z-[1090]',
    'bg-overlay',
    'backdrop-blur-[2px]',
    'data-[state=open]:animate-in',
    'data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0',
    'data-[state=open]:fade-in-0',
);

const AlertModal = ({ open, options, onClose }: AlertComponentProps) => {
    return (
        <AlertDialogPrimitive.Root
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && options.dismissible) {
                    onClose();
                }
            }}
        >
            <AlertDialogPrimitive.Portal>
                <AlertDialogPrimitive.Overlay className={alertDialogOverlayClassName} />
                <div className="pointer-events-none fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <AlertDialogPrimitive.Content className={dialogContentVariants({ variant: 'confirm' })}>
                        <div className={dialogBodyVariants({ variant: 'confirm' })}>
                            <AlertDialogPrimitive.Title className={dialogTitleVariants({ variant: 'confirm' })}>
                                {options.title}
                            </AlertDialogPrimitive.Title>
                            {options.description ? (
                                <AlertDialogPrimitive.Description
                                    className={dialogDescriptionVariants({ variant: 'confirm' })}
                                >
                                    {options.description}
                                </AlertDialogPrimitive.Description>
                            ) : null}
                        </div>
                        <div className={dialogFooterVariants({ variant: 'confirm' })}>
                            <AlertDialogPrimitive.Action asChild>
                                <Button size="sm" onClick={onClose}>
                                    {options.confirmLabel}
                                </Button>
                            </AlertDialogPrimitive.Action>
                        </div>
                    </AlertDialogPrimitive.Content>
                </div>
            </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
    );
};

const ConfirmModal = ({ open, options, onCancel, onConfirm }: ConfirmComponentProps) => {
    return (
        <AlertDialogPrimitive.Root
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && options.dismissible) {
                    onCancel();
                }
            }}
        >
            <AlertDialogPrimitive.Portal>
                <AlertDialogPrimitive.Overlay className={alertDialogOverlayClassName} />
                <div className="pointer-events-none fixed inset-0 z-[1100] flex items-center justify-center p-4">
                    <AlertDialogPrimitive.Content className={dialogContentVariants({ variant: 'confirm' })}>
                        <div className={dialogBodyVariants({ variant: 'confirm' })}>
                            <AlertDialogPrimitive.Title className={dialogTitleVariants({ variant: 'confirm' })}>
                                {options.title}
                            </AlertDialogPrimitive.Title>
                            {options.description ? (
                                <AlertDialogPrimitive.Description
                                    className={dialogDescriptionVariants({ variant: 'confirm' })}
                                >
                                    <Text as="span" variant="meta" tone="secondary">
                                        {options.description}
                                    </Text>
                                </AlertDialogPrimitive.Description>
                            ) : null}
                        </div>
                        <div className={dialogFooterVariants({ variant: 'confirm' })}>
                            <AlertDialogPrimitive.Cancel asChild>
                                <Button variant="ghost" size="sm" onClick={onCancel}>
                                    {options.cancelLabel}
                                </Button>
                            </AlertDialogPrimitive.Cancel>
                            <AlertDialogPrimitive.Action asChild>
                                <Button
                                    variant={options.tone === 'danger' ? 'danger' : 'primary'}
                                    size="sm"
                                    onClick={onConfirm}
                                >
                                    {options.confirmLabel}
                                </Button>
                            </AlertDialogPrimitive.Action>
                        </div>
                    </AlertDialogPrimitive.Content>
                </div>
            </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
    );
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    return (
        <BaseModalProvider
            components={{
                Alert: AlertModal,
                Confirm: ConfirmModal,
            }}
        >
            {children}
        </BaseModalProvider>
    );
}
