import type { Controller } from '~/types/index.js';
import {
    createNoteFromMarkdown,
    InvalidNoteAuthoringInputError,
    updateNoteFromMarkdown
} from '~/modules/note-authoring.js';
import { deleteNoteById } from '~/modules/note-cleanup.js';
import { MCP_SNAPSHOT_META } from '~/modules/note-snapshot.js';
import type { NoteLayout } from '~/models.js';

const NOTE_LAYOUTS = new Set<NoteLayout>(['narrow', 'wide', 'full']);

const resolveNoteLayout = (value: unknown): NoteLayout | null | undefined => {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value === 'string' && NOTE_LAYOUTS.has(value as NoteLayout)) {
        return value as NoteLayout;
    }

    return null;
};

export const createMcpCreateNoteHandler = (
    createNote = createNoteFromMarkdown
): Controller => {
    return async (req, res) => {
        const { title, markdown, layout } = req.body ?? {};
        const resolvedLayout = resolveNoteLayout(layout);

        if (typeof title !== 'string') {
            res.status(400).json({
                code: 'INVALID_NOTE_TITLE',
                message: 'A note title is required.'
            }).end();
            return;
        }

        if (markdown !== undefined && typeof markdown !== 'string') {
            res.status(400).json({
                code: 'INVALID_NOTE_MARKDOWN',
                message: 'Note markdown must be a string.'
            }).end();
            return;
        }

        if (layout !== undefined && resolvedLayout === null) {
            res.status(400).json({
                code: 'INVALID_NOTE_LAYOUT',
                message: 'Note layout must be one of narrow, wide, or full.'
            }).end();
            return;
        }

        try {
            const note = await createNote({
                title,
                ...(markdown !== undefined ? { markdown } : {}),
                ...(resolvedLayout ? { layout: resolvedLayout } : {})
            });

            res.status(200).json({
                created: true,
                note
            }).end();
        } catch (error) {
            if (error instanceof InvalidNoteAuthoringInputError) {
                res.status(400).json({
                    code: 'INVALID_NOTE_INPUT',
                    message: error.message
                }).end();
                return;
            }

            throw error;
        }
    };
};

export const createMcpUpdateNoteHandler = (
    updateNote = updateNoteFromMarkdown
): Controller => {
    return async (req, res) => {
        const {
            id, title, markdown, layout, editSessionId
        } = req.body ?? {};
        const noteId = Number(id);
        const resolvedLayout = resolveNoteLayout(layout);

        if (!Number.isInteger(noteId) || noteId <= 0) {
            res.status(400).json({
                code: 'INVALID_NOTE_ID',
                message: 'A valid note id is required.'
            }).end();
            return;
        }

        if (title !== undefined && typeof title !== 'string') {
            res.status(400).json({
                code: 'INVALID_NOTE_TITLE',
                message: 'Note title must be a string.'
            }).end();
            return;
        }

        if (markdown !== undefined && typeof markdown !== 'string') {
            res.status(400).json({
                code: 'INVALID_NOTE_MARKDOWN',
                message: 'Note markdown must be a string.'
            }).end();
            return;
        }

        if (layout !== undefined && resolvedLayout === null) {
            res.status(400).json({
                code: 'INVALID_NOTE_LAYOUT',
                message: 'Note layout must be one of narrow, wide, or full.'
            }).end();
            return;
        }

        if (editSessionId !== undefined && typeof editSessionId !== 'string') {
            res.status(400).json({
                code: 'INVALID_EDIT_SESSION_ID',
                message: 'Edit session id must be a string.'
            }).end();
            return;
        }

        if (
            title === undefined &&
            markdown === undefined &&
            layout === undefined
        ) {
            res.status(400).json({
                code: 'INVALID_NOTE_INPUT',
                message: 'At least one note field must be provided for update.'
            }).end();
            return;
        }

        try {
            const note = await updateNote({
                id: noteId,
                ...(title !== undefined ? { title } : {}),
                ...(markdown !== undefined ? { markdown } : {}),
                ...(resolvedLayout ? { layout: resolvedLayout } : {}),
                ...(editSessionId !== undefined ? { editSessionId } : {}),
                snapshotMeta: MCP_SNAPSHOT_META
            });

            if (!note) {
                res.status(404).json({
                    code: 'NOTE_NOT_FOUND',
                    message: 'The requested note was not found.'
                }).end();
                return;
            }

            res.status(200).json({
                updated: true,
                note
            }).end();
        } catch (error) {
            if (error instanceof InvalidNoteAuthoringInputError) {
                res.status(400).json({
                    code: 'INVALID_NOTE_INPUT',
                    message: error.message
                }).end();
                return;
            }

            throw error;
        }
    };
};

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
