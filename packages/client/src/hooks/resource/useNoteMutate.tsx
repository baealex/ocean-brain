import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { createNote, deleteNote, fetchBackReferences, pinNote } from '~/apis/note.api';
import { NoteReferenceWarningModal } from '~/components/note';
import { useConfirm, useToast } from '~/components/ui';
import type { Note, NoteLayout } from '~/models/note.model';
import { replaceFixedPlaceholder } from '~/modules/fixed-placeholder';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE } from '~/modules/url';

const MOVE_TO_TRASH_REFERENCE_WARNING = {
    title: 'Move note to Trash?',
    description:
        'This note is referenced by the notes below. Those links may stop opening while this note stays in Trash. If you restore this note later, the links will work again.',
    confirmLabel: 'Move to Trash',
    confirmVariant: 'soft-danger' as const,
};

interface DeleteWarningState {
    id: string;
    callback?: () => void;
    backReferences: Pick<Note, 'id' | 'title'>[];
}

const useNoteMutate = () => {
    const confirm = useConfirm();
    const toast = useToast();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [deleteWarningState, setDeleteWarningState] = useState<DeleteWarningState | null>(null);

    const onCreate = async (title = '', content = '', layout?: NoteLayout) => {
        const replacedTitle = replaceFixedPlaceholder(title);
        const replacedContent = replaceFixedPlaceholder(content);
        const response = await createNote({
            title: replacedTitle,
            content: replacedContent,
            ...(layout && { layout }),
        });
        if (response.type === 'error') {
            return;
        }
        navigate({
            to: NOTE_ROUTE,
            params: { id: response.createNote.id },
        });
    };

    const onPinned = async (id: string, isPinned: boolean, callback?: () => void) => {
        try {
            const response = await pinNote(id, !isPinned);
            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.listAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.tagListAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.pinned(),
                    exact: true,
                }),
            ]);
            callback?.();
        } catch {
            toast('Failed to update note pin status');
        }
    };

    const moveNoteToTrash = async (id: string, callback?: () => void) => {
        const response = await deleteNote(id);
        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: queryKeys.notes.all(),
                exact: false,
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.tags.all(),
                exact: false,
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.reminders.all(),
                exact: false,
            }),
            queryClient.invalidateQueries({
                queryKey: queryKeys.images.all(),
                exact: false,
            }),
            queryClient.invalidateQueries({
                queryKey: ['calendar'],
                exact: false,
            }),
        ]);
        toast('The note has been moved to trash.');
        callback?.();
    };

    const handleDeleteWarningConfirm = async () => {
        if (!deleteWarningState) {
            return;
        }

        const { id, callback } = deleteWarningState;
        setDeleteWarningState(null);
        await moveNoteToTrash(id, callback);
    };

    const onDelete = async (id: string, callback?: () => void) => {
        const backReferencesResponse = await fetchBackReferences(id);

        if (backReferencesResponse.type === 'error') {
            toast('Failed to check linked notes before moving this note to Trash.');
            return;
        }

        queryClient.setQueryData(queryKeys.notes.backReferences(id), backReferencesResponse.backReferences);

        if (backReferencesResponse.backReferences.length > 0) {
            setDeleteWarningState({
                id,
                callback,
                backReferences: backReferencesResponse.backReferences,
            });
            return;
        }

        if (await confirm('Move this note to trash?')) {
            await moveNoteToTrash(id, callback);
        }
    };

    return {
        onCreate,
        onPinned,
        onDelete,
        deleteWarningDialog: (
            <NoteReferenceWarningModal
                isOpen={Boolean(deleteWarningState)}
                title={MOVE_TO_TRASH_REFERENCE_WARNING.title}
                description={MOVE_TO_TRASH_REFERENCE_WARNING.description}
                references={deleteWarningState?.backReferences ?? []}
                confirmLabel={MOVE_TO_TRASH_REFERENCE_WARNING.confirmLabel}
                confirmVariant={MOVE_TO_TRASH_REFERENCE_WARNING.confirmVariant}
                onClose={() => setDeleteWarningState(null)}
                onConfirm={() => void handleDeleteWarningConfirm()}
            />
        ),
    };
};

export default useNoteMutate;
