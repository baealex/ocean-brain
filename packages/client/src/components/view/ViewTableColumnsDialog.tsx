import { useState } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import { ModalActionRow } from '~/components/shared';
import { Button, Modal, Text } from '~/components/ui';
import type { ViewDisplayOptions, ViewSection, ViewTableColumn } from '~/models/view.model';
import ViewTableColumnsEditor from './ViewTableColumnsEditor';

interface ViewTableColumnsDialogProps {
    section: ViewSection;
    availableProperties: NotePropertyKeySummary[];
    isPropertiesLoading: boolean;
    isPropertiesError: boolean;
    onRetryProperties: () => void;
    onClose: () => void;
    onSave: (options: ViewDisplayOptions) => Promise<boolean>;
}

export default function ViewTableColumnsDialog({
    section,
    availableProperties,
    isPropertiesLoading,
    isPropertiesError,
    onRetryProperties,
    onClose,
    onSave,
}: ViewTableColumnsDialogProps) {
    const [columns, setColumns] = useState<ViewTableColumn[]>(section.displayOptions.tableColumns);
    const [propertyKeys, setPropertyKeys] = useState(section.displayOptions.tablePropertyKeys);
    const [isSaving, setIsSaving] = useState(false);

    const close = () => {
        if (!isSaving) onClose();
    };
    const save = async () => {
        setIsSaving(true);
        try {
            if (await onSave({ ...section.displayOptions, tableColumns: columns, tablePropertyKeys: propertyKeys }))
                onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen onClose={close} variant="form" className="sm:max-w-[560px]">
            <Modal.Header title="Table columns" onClose={close} />
            <Modal.Body>
                {isPropertiesLoading ? (
                    <Text as="p" variant="meta" tone="tertiary" className="mb-3">
                        Loading properties...
                    </Text>
                ) : null}
                {isPropertiesError ? (
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <Text as="p" variant="meta" tone="tertiary">
                            Property names could not be loaded.
                        </Text>
                        <Button type="button" variant="ghost" size="sm" onClick={onRetryProperties}>
                            Retry
                        </Button>
                    </div>
                ) : null}
                <fieldset disabled={isSaving}>
                    <ViewTableColumnsEditor
                        columns={columns}
                        propertyKeys={propertyKeys}
                        availableProperties={availableProperties}
                        onColumnsChange={setColumns}
                        onPropertyKeysChange={setPropertyKeys}
                    />
                </fieldset>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button type="button" variant="ghost" size="sm" onClick={close} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={() => void save()} isLoading={isSaving}>
                        Save columns
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
