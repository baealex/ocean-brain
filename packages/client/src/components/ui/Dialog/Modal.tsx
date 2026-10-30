import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader } from './Dialog';
import type { DialogVariant } from './variants';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
    className?: string;
    variant?: DialogVariant;
    avoidKeyboard?: boolean;
}

const Modal = ({ isOpen, onClose, children, className, variant = 'default', avoidKeyboard = false }: ModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent variant={variant} className={className} avoidKeyboard={avoidKeyboard}>
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
