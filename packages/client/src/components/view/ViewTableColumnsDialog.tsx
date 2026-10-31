import { useState } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import { ModalActionRow } from '~/components/shared';
import { Button, Modal, Text } from '~/components/ui';
import type { View, ViewDisplayOptions, ViewTableColumn } from '~/models/view.model';
import ViewTableColumnsEditor from './ViewTableColumnsEditor';

interface ViewTableColumnsDialogProps {
    view: View;
    availableProperties: NotePropertyKeySummary[];
    isPropertiesLoading: boolean;
    isPropertiesError: boolean;
    onRetryProperties: () => void;
    onClose: () => void;
    onSave: (options: ViewDisplayOptions) => Promise<boolean>;
}

export default function ViewTableColumnsDialog({
    view,
    availableProperties,
    isPropertiesLoading,
    isPropertiesError,
    onRetryProperties,
    onClose,
    onSave,
}: ViewTableColumnsDialogProps) {
    const isBoard = view.displayType === 'board';
    const editorProperties = isBoard
        ? availableProperties.filter((property) => property.key !== view.displayOptions.boardGroupByPropertyKey)
        : availableProperties;
    const [columns, setColumns] = useState<ViewTableColumn[]>(view.displayOptions.tableColumns);
    const [propertyKeys, setPropertyKeys] = useState(view.displayOptions.tablePropertyKeys);
    const [isSaving, setIsSaving] = useState(false);

    const close = () => {
        if (!isSaving) onClose();
    };
    const save = async () => {
        setIsSaving(true);
        try {
            if (await onSave({ ...view.displayOptions, tableColumns: columns, tablePropertyKeys: propertyKeys }))
                onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen onClose={close} variant="form" className="sm:max-w-[560px]">
            <Modal.Header title={isBoard ? 'Card fields' : 'Table columns'} onClose={close} />
            <Modal.Body>
                {isPropertiesLoading ? (
                    <Text as="p" variant="meta" tone="tertiary" className="mb-3">
                        Loading properties...
                    </Text>
                ) : null}
                {isPropertiesError ? (
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <Text as="p" variant="meta" tone="error">
                            Property names could not be loaded.
                        </Text>
                        <Button type="button" variant="subtle" size="sm" onClick={onRetryProperties}>
                            Retry
                        </Button>
                    </div>
                ) : null}
                <fieldset disabled={isSaving}>
                    <ViewTableColumnsEditor
                        target={isBoard ? 'board' : 'table'}
                        columns={columns}
                        propertyKeys={propertyKeys}
                        availableProperties={editorProperties}
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
                        {isBoard ? 'Save fields' : 'Save columns'}
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
