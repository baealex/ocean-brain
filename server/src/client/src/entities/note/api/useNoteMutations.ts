import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createNote, updateNote, deleteNote, pinNote, reorderNotes } from './note.api';
import type { NoteOrderInput } from './note.api';

export const useNoteCreate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createNote,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
        }
    });
};

export const useNoteUpdate = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateNote,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
        }
    });
};

export const useNoteDelete = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteNote,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
        }
    });
};

export const useNotePin = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => pinNote(id, pinned),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['pinnedNotes'] });
        }
    });
};

export const useNoteReorder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (notes: NoteOrderInput[]) => reorderNotes(notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            queryClient.invalidateQueries({ queryKey: ['pinnedNotes'] });
        }
    });
};
