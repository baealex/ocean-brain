import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter
} from './Dialog';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
}

const Modal = ({ isOpen, onClose, children }: ModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                {children}
            </DialogContent>
        </Dialog>
    );
};

Modal.Header = DialogHeader;
Modal.Body = DialogBody;
Modal.Footer = DialogFooter;

export { Modal };
