import { useState, useEffect } from 'react';
import { Button, Modal } from '~/components/shared';

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
                        <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300">
                            Note Layout
                        </label>
                        <div className="flex flex-col gap-2">
                            {LAYOUT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setSelectedLayout(option.value)}
                                    className={`p-3 sm:p-4 rounded-lg text-left transition-all ${selectedLayout === option.value
                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500'
                                            : 'bg-gray-50 dark:bg-zinc-800 border-2 border-transparent hover:border-gray-300 dark:hover:border-zinc-600'
                                        }`}>
                                    <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-zinc-100">
                                        {option.label}
                                    </div>
                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-1">
                                        {option.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} className="bg-gray-200 dark:bg-zinc-700 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                        Apply
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
}
