import { Button, Modal, ModalActionRow } from '~/components/shared';
import { Text } from '~/components/ui';

interface NoteExternalChangeModalProps {
    isOpen: boolean;
    isDeleted: boolean;
    isConflict: boolean;
    hasDraft: boolean;
    source: 'web' | 'mcp' | 'unknown';
    isReloading: boolean;
    onReload: () => void;
    onOverwrite: () => void;
    onCloneDraft: () => void;
    onOpenTrash: () => void;
}

const getSourceLabel = (source: NoteExternalChangeModalProps['source']) => {
    if (source === 'mcp') {
        return {
            actor: 'An MCP client',
            place: 'through MCP',
            target: 'the MCP update',
        };
    }

    if (source === 'web') {
        return {
            actor: 'Another browser tab',
            place: 'in another tab',
            target: 'the tab update',
        };
    }

    return {
        actor: 'Another editor',
        place: 'elsewhere',
        target: 'the outside change',
    };
};

const getTitle = ({
    isDeleted,
    isConflict,
    source,
}: Pick<NoteExternalChangeModalProps, 'isDeleted' | 'isConflict' | 'source'>) => {
    const sourceLabel = getSourceLabel(source);

    if (isDeleted) {
        return `This note was moved to trash ${sourceLabel.place}`;
    }

    if (isConflict) {
        return `Save paused: note changed ${sourceLabel.place}`;
    }

    return `This note changed ${sourceLabel.place}`;
};

const getDescription = ({
    isDeleted,
    isConflict,
    hasDraft,
    source,
}: Pick<NoteExternalChangeModalProps, 'isDeleted' | 'isConflict' | 'hasDraft' | 'source'>) => {
    const sourceLabel = getSourceLabel(source);

    if (isDeleted) {
        return `${sourceLabel.actor} moved this note to trash. Open trash to review or restore it.`;
    }

    if (isConflict && hasDraft) {
        return `Your draft is saved locally. Reload the latest note, overwrite ${sourceLabel.target}, or clone your draft into a new note.`;
    }

    if (isConflict) {
        return `The layout change is paused because the note changed ${sourceLabel.place}. Reload the latest note or overwrite only the layout.`;
    }

    return `${sourceLabel.actor} changed this note while it was open here. Reload the latest version before continuing.`;
};

export default function NoteExternalChangeModal({
    isOpen,
    isDeleted,
    isConflict,
    hasDraft,
    source,
    isReloading,
    onReload,
    onOverwrite,
    onCloneDraft,
    onOpenTrash,
}: NoteExternalChangeModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={() => undefined} variant="inspect">
            <Modal.Header title={getTitle({ isDeleted, isConflict, source })} />
            <Modal.Body>
                <Text as="p" variant="body" tone="secondary" className="leading-6">
                    {getDescription({ isDeleted, isConflict, hasDraft, source })}
                </Text>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    {isDeleted ? (
                        <Button type="button" variant="primary" size="sm" onClick={onOpenTrash}>
                            Open trash
                        </Button>
                    ) : isConflict ? (
                        <>
                            <Button type="button" variant="subtle" size="sm" isLoading={isReloading} onClick={onReload}>
                                Reload latest
                            </Button>
                            {hasDraft && (
                                <Button type="button" variant="ghost" size="sm" onClick={onCloneDraft}>
                                    Clone draft
                                </Button>
                            )}
                            <Button type="button" variant="danger" size="sm" onClick={onOverwrite}>
                                Overwrite
                            </Button>
                        </>
                    ) : (
                        <Button type="button" variant="primary" size="sm" isLoading={isReloading} onClick={onReload}>
                            Reload latest
                        </Button>
                    )}
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
