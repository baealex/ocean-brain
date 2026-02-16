import { useQueryClient } from '@tanstack/react-query';

import {
    createNote,
    deleteNote,
    pinNote
} from '~/apis/note.api';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '~/components/ui';
import { getPinnedNoteQueryKey } from '~/modules/query-key-factory';
import { replaceFixedPlaceholder } from '~/modules/fixed-placeholder';

import type { NoteLayout } from '~/models/note.model';

const useNoteMutate = () => {
    const confirm = useConfirm();
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
            await pinNote(id, !isPinned);
            await queryClient.invalidateQueries({ queryKey: ['notes'] });
            await queryClient.invalidateQueries({ queryKey: ['tag-notes'] });
            await queryClient.invalidateQueries({ queryKey: [getPinnedNoteQueryKey()] });
            callback?.();
        } catch {
            // console.error(error);
        }
    };

    const onDelete = async (id: string, callback?: () => void) => {
        if (await confirm('Are you really sure?')) {
            await deleteNote(id);
            await queryClient.invalidateQueries({ queryKey: ['notes'] });
            await queryClient.invalidateQueries({ queryKey: ['tag-notes'] });
            await queryClient.invalidateQueries({ queryKey: [getPinnedNoteQueryKey()] });
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
