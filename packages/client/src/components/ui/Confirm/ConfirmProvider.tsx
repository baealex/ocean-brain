import {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState
} from 'react';

import { Button } from '../Button';
import { Modal } from '../Dialog/Modal';

interface ConfirmContextValue {
    confirm: (message: string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((message: string): Promise<boolean> => {
        setMessage(message);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        resolveRef.current?.(true);
        resolveRef.current = null;
        setIsOpen(false);
    };

    const handleCancel = () => {
        resolveRef.current?.(false);
        resolveRef.current = null;
        setIsOpen(false);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <Modal isOpen={isOpen} onClose={handleCancel} className="max-w-[360px]">
                <Modal.Body className="px-5 pb-4 pt-5">
                    <p className="mb-1 text-base font-semibold text-fg-default">Confirm</p>
                    <p className="text-sm leading-6 text-fg-secondary">{message}</p>
                </Modal.Body>
                <div className="flex justify-end gap-2 px-5 pb-5">
                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleConfirm}>
                        OK
                    </Button>
                </div>
            </Modal>
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context.confirm;
}
