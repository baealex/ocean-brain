import { useCallback, useRef, useState } from 'react';

import { Button } from '../Button';
import { Modal } from '../Dialog/Modal';
import { Text } from '../Text';
import { ConfirmContext } from './ConfirmContext';

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
            <Modal isOpen={isOpen} onClose={handleCancel} variant="confirm">
                <Modal.Body>
                    <Text as="p" variant="subheading" weight="semibold" tracking="tight">
                        Confirm
                    </Text>
                    <Text as="p" variant="meta" tone="secondary">
                        {message}
                    </Text>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleConfirm}>
                        OK
                    </Button>
                </Modal.Footer>
            </Modal>
        </ConfirmContext.Provider>
    );
}
