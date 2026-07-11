import { Button, Callout } from '~/components/shared';

interface NoteRecoveryCalloutsProps {
    localDraftCreatedAt: string | null;
    hasSaveError: boolean;
    onRestoreDraft: () => void;
    onDiscardDraft: () => void;
    onRetrySave: () => void;
    onSaveAsNewNote: () => void;
}

export default function NoteRecoveryCallouts({
    localDraftCreatedAt,
    hasSaveError,
    onRestoreDraft,
    onDiscardDraft,
    onRetrySave,
    onSaveAsNewNote,
}: NoteRecoveryCalloutsProps) {
    return (
        <>
            {localDraftCreatedAt && (
                <Callout tone="danger" className="mb-6">
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>A draft from {localDraftCreatedAt} is saved only in this browser.</span>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="subtle"
                                className="self-start"
                                onClick={onRestoreDraft}
                            >
                                Restore draft
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="self-start"
                                onClick={onDiscardDraft}
                            >
                                Discard
                            </Button>
                        </div>
                    </div>
                </Callout>
            )}

            {hasSaveError && (
                <Callout tone="danger" className="mb-6">
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                            Save failed. Your latest draft is still available here. Retry before leaving this note.
                        </span>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="subtle"
                                className="self-start"
                                onClick={onRetrySave}
                            >
                                Retry save
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="self-start"
                                onClick={onSaveAsNewNote}
                            >
                                Save as new note
                            </Button>
                        </div>
                    </div>
                </Callout>
            )}
        </>
    );
}
