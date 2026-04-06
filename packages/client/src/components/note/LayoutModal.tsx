import { useState, useEffect } from 'react';
import { Modal, ModalActionRow, SelectionOptionCard } from '~/components/shared';
import { Button, Text } from '~/components/ui';

import type { NoteLayout } from '~/models/note.model';

interface LayoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (layout: NoteLayout) => void;
    currentLayout?: NoteLayout;
}

const LAYOUT_OPTIONS = [
    {
        value: 'narrow' as const,
        label: 'Narrow',
        description: 'Optimized for reading long-form content'
    },
    {
        value: 'wide' as const,
        label: 'Wide',
        description: 'Balanced width suitable for most content'
    },
    {
        value: 'full' as const,
        label: 'Full Width',
        description: 'Maximize screen space utilization'
    }
];

export default function LayoutModal({
    isOpen,
    onClose,
    onSave,
    currentLayout = 'wide'
}: LayoutModalProps) {
    const [selectedLayout, setSelectedLayout] = useState<NoteLayout>(currentLayout);

    useEffect(() => {
        if (isOpen) {
            setSelectedLayout(currentLayout);
        }
    }, [isOpen, currentLayout]);

    const handleSave = () => {
        onSave(selectedLayout);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <Modal.Header
                title="Layout Settings"
                onClose={onClose}
            />
            <Modal.Body>
                <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex flex-col gap-2">
                        <Text as="div" weight="semibold" tone="secondary">
                            Note Layout
                        </Text>
                        <div className="flex flex-col gap-2">
                            {LAYOUT_OPTIONS.map((option) => (
                                <SelectionOptionCard
                                    key={option.value}
                                    title={option.label}
                                    description={option.description}
                                    selected={selectedLayout === option.value}
                                    onClick={() => setSelectedLayout(option.value)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSave}>
                        Apply
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
