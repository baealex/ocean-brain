import { useEffect, useState } from 'react';

import { ModalActionRow } from '~/components/shared';
import { Button, Input, Label, Modal, Text } from '~/components/ui';

interface ViewTabDialogProps {
    open: boolean;
    mode: 'create' | 'edit';
    initialTitle?: string;
    onClose: () => void;
    onSubmit: (title: string) => void;
}

export default function ViewTabDialog({ open, mode, initialTitle = '', onClose, onSubmit }: ViewTabDialogProps) {
    const [title, setTitle] = useState(initialTitle);

    useEffect(() => {
        if (!open) {
            return;
        }

        setTitle(initialTitle);
    }, [initialTitle, open]);

    return (
        <Modal isOpen={open} onClose={onClose} variant="form" className="sm:max-w-[480px]">
            <Modal.Header title={mode === 'create' ? 'Create view tab' : 'Rename view tab'} onClose={onClose} />
            <Modal.Body>
                <form
                    id="view-tab-form"
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSubmit(title);
                    }}
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="view-tab-title" size="md">
                            Tab name
                        </Label>
                        <Input
                            id="view-tab-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Now"
                            autoFocus
                        />
                    </div>
                    <Text as="p" variant="meta" tone="tertiary">
                        Each tab is one saved view inside the Views page.
                    </Text>
                </form>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" size="sm" form="view-tab-form">
                        {mode === 'create' ? 'Create tab' : 'Save tab'}
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
