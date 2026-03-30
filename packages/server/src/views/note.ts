import type { Controller } from '~/types/index.js';
import { deleteNoteById } from '~/modules/note-cleanup.js';

export const createMcpDeleteNoteHandler = (
    deleteNote = deleteNoteById
): Controller => {
    return async (req, res) => {
        const id = Number(req.body?.id);

        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({
                code: 'INVALID_NOTE_ID',
                message: 'A valid note id is required.'
            }).end();
            return;
        }

        const deletedNote = await deleteNote(id);

        if (!deletedNote) {
            res.status(404).json({
                code: 'NOTE_NOT_FOUND',
                message: 'The requested note was not found.'
            }).end();
            return;
        }

        res.status(200).json({
            deleted: true,
            note: deletedNote
        }).end();
    };
};
