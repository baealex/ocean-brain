import { useEffect, useState } from 'react';

import { ModalActionRow } from '~/components/shared';
import { Button, Input, Label, Modal, Text } from '~/components/ui';

interface ViewGroupDialogProps {
    open: boolean;
    mode: 'create' | 'edit';
    initialTitle?: string;
    onClose: () => void;
    onSubmit: (title: string) => void;
}

export default function ViewGroupDialog({ open, mode, initialTitle = '', onClose, onSubmit }: ViewGroupDialogProps) {
    const [title, setTitle] = useState(initialTitle);

    useEffect(() => {
        if (!open) {
            return;
        }

        setTitle(initialTitle);
    }, [initialTitle, open]);

    return (
        <Modal isOpen={open} onClose={onClose} variant="form" className="sm:max-w-[480px]">
            <Modal.Header title={mode === 'create' ? 'Create view group' : 'Rename view group'} onClose={onClose} />
            <Modal.Body>
                <form
                    id="view-group-form"
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSubmit(title);
                    }}
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="view-group-title" size="md">
                            Group name
                        </Label>
                        <Input
                            id="view-group-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Now"
                            autoFocus
                        />
                    </div>
                    <Text as="p" variant="meta" tone="tertiary">
                        A view group organizes saved views. Each view has its own filters and display format.
                    </Text>
                </form>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" size="sm" form="view-group-form">
                        {mode === 'create' ? 'Create group' : 'Save group'}
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
