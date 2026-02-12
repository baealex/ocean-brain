import { useState, useEffect } from 'react';
import { Modal } from '~/components/shared';
import { Button } from '~/components/ui';

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
                        <label className="text-xs sm:text-sm font-bold text-fg-muted">
                            Note Layout
                        </label>
                        <div className="flex flex-col gap-2">
                            {LAYOUT_OPTIONS.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={selectedLayout === option.value ? 'primary' : 'ghost'}
                                    className={`!justify-start !text-left !h-auto p-3 sm:p-4 ${selectedLayout === option.value ? 'shadow-sketchy' : ''}`}
                                    onClick={() => setSelectedLayout(option.value)}>
                                    <div>
                                        <div className="font-bold text-sm sm:text-base text-fg-default">
                                            {option.label}
                                        </div>
                                        <div className="text-xs sm:text-sm text-fg-tertiary mt-1 font-medium">
                                            {option.description}
                                        </div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                        Apply
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
}
