import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogDescription
} from './Dialog';
import type { DialogVariant } from './variants';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
    className?: string;
    variant?: DialogVariant;
}

const Modal = ({
    isOpen, onClose, children, className, variant = 'default'
}: ModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent variant={variant} className={className}>
                {children}
            </DialogContent>
        </Dialog>
    );
};

Modal.Header = DialogHeader;
Modal.Body = DialogBody;
Modal.Footer = DialogFooter;
Modal.Description = DialogDescription;

export { Modal };
