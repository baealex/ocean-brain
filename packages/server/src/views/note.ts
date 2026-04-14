import type { NoteLayout } from '~/models.js';
import { createAppError } from '~/modules/error-handler.js';
import {
    createNoteFromMarkdown,
    InvalidNoteAuthoringInputError,
    updateNoteFromMarkdown,
} from '~/modules/note-authoring.js';
import { deleteNoteById } from '~/modules/note-cleanup.js';
import { MCP_SNAPSHOT_META } from '~/modules/note-snapshot.js';
import type { Controller } from '~/types/index.js';

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

export const createMcpCreateNoteHandler = (createNote = createNoteFromMarkdown): Controller => {
    return async (req, res) => {
        const { title, markdown, layout } = req.body ?? {};
        const resolvedLayout = resolveNoteLayout(layout);

        if (typeof title !== 'string') {
            throw createAppError(400, 'INVALID_NOTE_TITLE', 'A note title is required.');
        }

        if (markdown !== undefined && typeof markdown !== 'string') {
            throw createAppError(400, 'INVALID_NOTE_MARKDOWN', 'Note markdown must be a string.');
        }

        if (layout !== undefined && resolvedLayout === null) {
            throw createAppError(400, 'INVALID_NOTE_LAYOUT', 'Note layout must be one of narrow, wide, or full.');
        }

        try {
            const note = await createNote({
                title,
                ...(markdown !== undefined ? { markdown } : {}),
                ...(resolvedLayout ? { layout: resolvedLayout } : {}),
            });

            res.status(200)
                .json({
                    created: true,
                    note,
                })
                .end();
        } catch (error) {
            if (error instanceof InvalidNoteAuthoringInputError) {
                throw createAppError(400, 'INVALID_NOTE_INPUT', error.message);
            }

            throw error;
        }
    };
};

export const createMcpUpdateNoteHandler = (updateNote = updateNoteFromMarkdown): Controller => {
    return async (req, res) => {
        const { id, title, markdown, layout, editSessionId } = req.body ?? {};
        const noteId = Number(id);
        const resolvedLayout = resolveNoteLayout(layout);

        if (!Number.isInteger(noteId) || noteId <= 0) {
            throw createAppError(400, 'INVALID_NOTE_ID', 'A valid note id is required.');
        }

        if (title !== undefined && typeof title !== 'string') {
            throw createAppError(400, 'INVALID_NOTE_TITLE', 'Note title must be a string.');
        }

        if (markdown !== undefined && typeof markdown !== 'string') {
            throw createAppError(400, 'INVALID_NOTE_MARKDOWN', 'Note markdown must be a string.');
        }

        if (layout !== undefined && resolvedLayout === null) {
            throw createAppError(400, 'INVALID_NOTE_LAYOUT', 'Note layout must be one of narrow, wide, or full.');
        }

        if (editSessionId !== undefined && typeof editSessionId !== 'string') {
            throw createAppError(400, 'INVALID_EDIT_SESSION_ID', 'Edit session id must be a string.');
        }

        if (title === undefined && markdown === undefined && layout === undefined) {
            throw createAppError(400, 'INVALID_NOTE_INPUT', 'At least one note field must be provided for update.');
        }

        try {
            const note = await updateNote({
                id: noteId,
                ...(title !== undefined ? { title } : {}),
                ...(markdown !== undefined ? { markdown } : {}),
                ...(resolvedLayout ? { layout: resolvedLayout } : {}),
                ...(editSessionId !== undefined ? { editSessionId } : {}),
                snapshotMeta: MCP_SNAPSHOT_META,
            });

            if (!note) {
                throw createAppError(404, 'NOTE_NOT_FOUND', 'The requested note was not found.');
            }

            res.status(200)
                .json({
                    updated: true,
                    note,
                })
                .end();
        } catch (error) {
            if (error instanceof InvalidNoteAuthoringInputError) {
                throw createAppError(400, 'INVALID_NOTE_INPUT', error.message);
            }

            throw error;
        }
    };
};

export const createMcpDeleteNoteHandler = (deleteNote = deleteNoteById): Controller => {
    return async (req, res) => {
        const id = Number(req.body?.id);

        if (!Number.isInteger(id) || id <= 0) {
            throw createAppError(400, 'INVALID_NOTE_ID', 'A valid note id is required.');
        }

        const deletedNote = await deleteNote(id);

        if (!deletedNote) {
            throw createAppError(404, 'NOTE_NOT_FOUND', 'The requested note was not found.');
        }

        res.status(200)
            .json({
                deleted: true,
                note: deletedNote,
            })
            .end();
    };
};
