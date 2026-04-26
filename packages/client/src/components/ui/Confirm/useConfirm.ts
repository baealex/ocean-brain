import { useModal } from '@baejino/react-ui/modal';
import { useCallback } from 'react';

export function useConfirm() {
    const { confirm } = useModal();

    return useCallback(
        (message: string) =>
            confirm({
                title: 'Confirm',
                description: message,
                confirmLabel: 'OK',
                cancelLabel: 'Cancel',
                tone: 'danger',
            }),
        [confirm],
    );
}
