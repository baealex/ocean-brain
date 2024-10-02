import { useQueryClient } from 'react-query';

import {
    createNote,
    deleteNote,
    pinNote
} from '~/apis/note.api';
import { confirm } from '@baejino/ui';
import { useNavigate } from 'react-router-dom';

const useNoteMutate = () => {
    const queryClient = useQueryClient();

    const navigate = useNavigate();

    const onCreate = async (content?: string) => {
        const { id } = await createNote({ content });
        navigate(`/${id}`);
    };

    const onPinned = async (id: string, isPinned: boolean, callback?: () => void) => {
        try {
            await pinNote(id, !isPinned);
            queryClient.invalidateQueries('notes');
            queryClient.invalidateQueries('pinned-notes');
            callback?.();
        } catch (error) {
            // console.error(error);
        }
    };

    const onDelete = async (id: string, callback?: () => void) => {
        if (await confirm('Are you really sure?')) {
            await deleteNote(id);
            queryClient.invalidateQueries('notes');
            queryClient.invalidateQueries('pinned-notes');
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
