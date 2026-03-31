import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import {
    createNote,
    deleteNote,
    pinNote
} from '~/apis/note.api';
import { useConfirm, useToast } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { replaceFixedPlaceholder } from '~/modules/fixed-placeholder';
import { NOTE_ROUTE } from '~/modules/url';

import type { NoteLayout } from '~/models/note.model';

const useNoteMutate = () => {
    const confirm = useConfirm();
    const toast = useToast();
    const queryClient = useQueryClient();

    const navigate = useNavigate();

    const onCreate = async (title = '', content = '', layout?: NoteLayout) => {
        const replacedTitle = replaceFixedPlaceholder(title);
        const replacedContent = replaceFixedPlaceholder(content);
        const response = await createNote({
            title: replacedTitle,
            content: replacedContent,
            ...(layout && { layout })
        });
        if (response.type === 'error') {
            return;
        }
        navigate({
            to: NOTE_ROUTE,
            params: { id: response.createNote.id }
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
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.tagListAll(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.pinned(),
                    exact: true
                })
            ]);
            callback?.();
        } catch {
            toast('Failed to update note pin status');
        }
    };

    const onDelete = async (id: string, callback?: () => void) => {
        if (await confirm('Are you really sure?')) {
            const response = await deleteNote(id);
            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.all(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.tags.all(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.reminders.all(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.images.all(),
                    exact: false
                }),
                queryClient.invalidateQueries({
                    queryKey: ['calendar'],
                    exact: false
                })
            ]);
            toast('The note has been moved to trash.');
            callback?.();
        }
    };

    return {
        onCreate,
        onPinned,
        onDelete
    };
};

export default useNoteMutate;
