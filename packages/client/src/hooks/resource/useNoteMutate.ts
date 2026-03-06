import { useQueryClient } from '@tanstack/react-query';

import {
    createNote,
    deleteNote,
    pinNote
} from '~/apis/note.api';
import { useNavigate } from 'react-router-dom';
import { useConfirm, useToast } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { replaceFixedPlaceholder } from '~/modules/fixed-placeholder';

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
        navigate(`/${response.createNote.id}`);
    };

    const onPinned = async (id: string, isPinned: boolean, callback?: () => void) => {
        try {
            const response = await pinNote(id, !isPinned);
            if (response.type === 'error') {
                toast(response.errors[0].message);
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.notes.listAll(), exact: false }),
                queryClient.invalidateQueries({ queryKey: queryKeys.notes.tagListAll(), exact: false }),
                queryClient.invalidateQueries({ queryKey: queryKeys.notes.pinned(), exact: true })
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
                queryClient.invalidateQueries({ queryKey: queryKeys.notes.listAll(), exact: false }),
                queryClient.invalidateQueries({ queryKey: queryKeys.notes.tagListAll(), exact: false }),
                queryClient.invalidateQueries({ queryKey: queryKeys.notes.pinned(), exact: true })
            ]);
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
