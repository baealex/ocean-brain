import {
    createNoteFromMarkdown,
    InvalidNoteAuthoringInputError,
    updateNoteFromMarkdown,
} from '~/features/note/services/authoring.js';
import { deleteNoteById } from '~/features/note/services/cleanup.js';
import {
    appendNoteMarkdown,
    patchNoteMarkdown,
    replaceNoteMarkdown,
    updateNoteMetadata,
} from '~/features/note/services/markdown-intent-write.js';
import type {
    MarkdownAppendPlacement,
    MarkdownChangePolicy,
    MarkdownPatchOperation,
    MarkdownPatchSelector,
} from '~/features/note/services/markdown-patch.js';
import { MCP_SNAPSHOT_META } from '~/features/note/services/snapshot.js';
import type { NoteLayout } from '~/models.js';
import { createAppError } from '~/modules/error-handler.js';
import { emitServerEvent, type ServerEventInput } from '~/modules/server-events.js';
import type { Controller } from '~/types/index.js';

const NOTE_LAYOUTS = new Set<NoteLayout>(['narrow', 'wide', 'full']);

const POSITION_HINTS = new Set(['first', 'last']);
const PRESERVATION_POLICIES = new Set<unknown>([true, false, 'warn']);

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const resolveNoteLayout = (value: unknown): NoteLayout | null | undefined => {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value === 'string' && NOTE_LAYOUTS.has(value as NoteLayout)) {
        return value as NoteLayout;
    }

    return null;
};

const resolveOptionalString = (value: unknown, code: string, message: string) => {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value === 'string') {
        return value;
    }

    throw createAppError(400, code, message);
};

const resolveOptionalBoolean = (value: unknown, code: string, message: string) => {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    throw createAppError(400, code, message);
};

const resolvePositiveNoteId = (value: unknown) => {
    const noteId = Number(value);

    if (!Number.isInteger(noteId) || noteId <= 0) {
        throw createAppError(400, 'INVALID_NOTE_ID', 'A valid note id is required.');
    }

    return noteId;
};

const isNonNegativeInteger = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
};

const isPositiveInteger = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
};

const resolveMarkdownWritePolicy = (value: unknown): MarkdownChangePolicy | undefined => {
    if (value === undefined) {
        return undefined;
    }

    if (!isRecord(value)) {
        throw createAppError(400, 'INVALID_MARKDOWN_POLICY', 'Markdown write policy must be an object.');
    }

    const policy: MarkdownChangePolicy = {};

    if (value.allowNoop !== undefined) {
        if (typeof value.allowNoop !== 'boolean') {
            throw createAppError(400, 'INVALID_MARKDOWN_POLICY', 'allowNoop must be a boolean.');
        }
        policy.allowNoop = value.allowNoop;
    }

    if (value.maxChangedChars !== undefined) {
        if (!isNonNegativeInteger(value.maxChangedChars)) {
            throw createAppError(400, 'INVALID_MARKDOWN_POLICY', 'maxChangedChars must be a non-negative integer.');
        }
        policy.maxChangedChars = value.maxChangedChars;
    }

    if (value.maxChangedLines !== undefined) {
        if (!isNonNegativeInteger(value.maxChangedLines)) {
            throw createAppError(400, 'INVALID_MARKDOWN_POLICY', 'maxChangedLines must be a non-negative integer.');
        }
        policy.maxChangedLines = value.maxChangedLines;
    }

    if (value.preserveTags !== undefined) {
        if (!PRESERVATION_POLICIES.has(value.preserveTags)) {
            throw createAppError(400, 'INVALID_MARKDOWN_POLICY', 'preserveTags must be boolean or warn.');
        }
        policy.preserveTags = value.preserveTags as MarkdownChangePolicy['preserveTags'];
    }

    if (value.preserveReferences !== undefined) {
        if (!PRESERVATION_POLICIES.has(value.preserveReferences)) {
            throw createAppError(400, 'INVALID_MARKDOWN_POLICY', 'preserveReferences must be boolean or warn.');
        }
        policy.preserveReferences = value.preserveReferences as MarkdownChangePolicy['preserveReferences'];
    }

    return policy;
};

const resolvePatchSelector = (value: unknown): MarkdownPatchSelector => {
    if (!isRecord(value)) {
        throw createAppError(400, 'INVALID_PATCH_SELECTOR', 'Patch selector must be an object.');
    }

    if (value.type === 'exact_text') {
        if (typeof value.text !== 'string') {
            throw createAppError(400, 'INVALID_PATCH_SELECTOR', 'Exact text selector requires text.');
        }

        return {
            type: 'exact_text',
            text: value.text,
            ...(value.before !== undefined
                ? {
                      before: resolveOptionalString(
                          value.before,
                          'INVALID_PATCH_SELECTOR',
                          'Selector before must be a string.',
                      ),
                  }
                : {}),
            ...(value.after !== undefined
                ? {
                      after: resolveOptionalString(
                          value.after,
                          'INVALID_PATCH_SELECTOR',
                          'Selector after must be a string.',
                      ),
                  }
                : {}),
        };
    }

    if (value.type === 'match_candidate') {
        const { text, matchIndex, lineStart, matchSha256, surroundingHash, positionHint } = value;

        if (
            typeof text !== 'string' ||
            !isNonNegativeInteger(matchIndex) ||
            !isPositiveInteger(lineStart) ||
            typeof matchSha256 !== 'string' ||
            typeof surroundingHash !== 'string'
        ) {
            throw createAppError(400, 'INVALID_PATCH_SELECTOR', 'Match candidate selector has invalid fields.');
        }

        if (positionHint !== undefined && !POSITION_HINTS.has(String(positionHint))) {
            throw createAppError(400, 'INVALID_PATCH_SELECTOR', 'positionHint must be first or last.');
        }

        return {
            type: 'match_candidate',
            text,
            matchIndex,
            lineStart,
            matchSha256,
            surroundingHash,
            ...(positionHint ? { positionHint: positionHint as 'first' | 'last' } : {}),
        };
    }

    throw createAppError(400, 'INVALID_PATCH_SELECTOR', 'Unsupported patch selector type.');
};

const resolvePatchOperation = (value: unknown): MarkdownPatchOperation => {
    if (!isRecord(value)) {
        throw createAppError(400, 'INVALID_PATCH_OPERATION', 'Patch operation must be an object.');
    }

    if (value.type === 'replace') {
        if (typeof value.replacement !== 'string') {
            throw createAppError(400, 'INVALID_PATCH_OPERATION', 'Replace operation requires replacement.');
        }

        return {
            type: 'replace',
            replacement: value.replacement,
        };
    }

    if (value.type === 'insert_before' || value.type === 'insert_after') {
        if (typeof value.insertion !== 'string') {
            throw createAppError(400, 'INVALID_PATCH_OPERATION', 'Insert operation requires insertion.');
        }

        return {
            type: value.type,
            insertion: value.insertion,
        };
    }

    throw createAppError(400, 'INVALID_PATCH_OPERATION', 'Unsupported patch operation type.');
};

const resolveAppendPlacement = (value: unknown): MarkdownAppendPlacement | undefined => {
    if (value === undefined) {
        return undefined;
    }

    if (!isRecord(value)) {
        throw createAppError(400, 'INVALID_APPEND_PLACEMENT', 'Append placement must be an object.');
    }

    if (value.type === 'end') {
        return { type: 'end' };
    }

    if (value.type === 'after_heading') {
        if (typeof value.heading !== 'string') {
            throw createAppError(400, 'INVALID_APPEND_PLACEMENT', 'after_heading placement requires heading.');
        }

        const { heading, level } = value;

        if (typeof heading !== 'string') {
            throw createAppError(400, 'INVALID_APPEND_PLACEMENT', 'after_heading placement requires heading.');
        }

        if (level !== undefined && (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6)) {
            throw createAppError(400, 'INVALID_APPEND_PLACEMENT', 'Heading level must be an integer from 1 to 6.');
        }

        return {
            type: 'after_heading',
            heading,
            ...(level !== undefined ? { level } : {}),
        };
    }

    throw createAppError(400, 'INVALID_APPEND_PLACEMENT', 'Unsupported append placement type.');
};

const resolveSeparator = (value: unknown) => {
    if (value === undefined) {
        return undefined;
    }

    if (value === '\n' || value === '\n\n') {
        return value;
    }

    throw createAppError(400, 'INVALID_SEPARATOR', 'Separator must be "\\n" or "\\n\\n".');
};

type EmitServerEvent = (event: ServerEventInput) => unknown;

export const createMcpCreateNoteHandler = (
    createNote = createNoteFromMarkdown,
    emitEvent: EmitServerEvent = emitServerEvent,
): Controller => {
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

            emitEvent({
                type: 'mcp.note.created',
                source: 'mcp',
                noteId: note.id,
                updatedAt: note.updatedAt,
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

export const createMcpUpdateNoteHandler = (
    updateNote = updateNoteFromMarkdown,
    emitEvent: EmitServerEvent = emitServerEvent,
): Controller => {
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

            emitEvent({
                type: 'mcp.note.updated',
                source: 'mcp',
                noteId: note.id,
                updatedAt: note.updatedAt,
            });

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

export const createMcpPatchNoteMarkdownHandler = (
    patchMarkdown = patchNoteMarkdown,
    emitEvent: EmitServerEvent = emitServerEvent,
): Controller => {
    return async (req, res) => {
        const { id, expectedUpdatedAt, baseMarkdownSha256, intent, selector, operation, policy, dryRun } =
            req.body ?? {};
        const noteId = resolvePositiveNoteId(id);
        const resolvedExpectedUpdatedAt = resolveOptionalString(
            expectedUpdatedAt,
            'INVALID_NOTE_VERSION',
            'expectedUpdatedAt must be a string.',
        );
        const resolvedBaseMarkdownSha256 = resolveOptionalString(
            baseMarkdownSha256,
            'INVALID_MARKDOWN_HASH',
            'baseMarkdownSha256 must be a string.',
        );
        const resolvedDryRun = resolveOptionalBoolean(dryRun, 'INVALID_DRY_RUN', 'dryRun must be a boolean.');

        if (typeof intent !== 'string') {
            throw createAppError(400, 'INVALID_PATCH_INTENT', 'Patch intent must be a string.');
        }

        const result = await patchMarkdown({
            id: noteId,
            expectedUpdatedAt: resolvedExpectedUpdatedAt,
            baseMarkdownSha256: resolvedBaseMarkdownSha256,
            intent,
            selector: resolvePatchSelector(selector),
            operation: resolvePatchOperation(operation),
            policy: resolveMarkdownWritePolicy(policy),
            dryRun: resolvedDryRun,
        });

        if (result.status === 'applied') {
            emitEvent({
                type: 'mcp.note.updated',
                source: 'mcp',
                noteId: result.note.id,
                updatedAt: result.note.updatedAt,
            });
        }

        res.status(200).json(result).end();
    };
};

export const createMcpAppendNoteMarkdownHandler = (
    appendMarkdown = appendNoteMarkdown,
    emitEvent: EmitServerEvent = emitServerEvent,
): Controller => {
    return async (req, res) => {
        const { id, expectedUpdatedAt, baseMarkdownSha256, intent, insertion, placement, separator, policy, dryRun } =
            req.body ?? {};
        const noteId = resolvePositiveNoteId(id);
        const resolvedExpectedUpdatedAt = resolveOptionalString(
            expectedUpdatedAt,
            'INVALID_NOTE_VERSION',
            'expectedUpdatedAt must be a string.',
        );
        const resolvedBaseMarkdownSha256 = resolveOptionalString(
            baseMarkdownSha256,
            'INVALID_MARKDOWN_HASH',
            'baseMarkdownSha256 must be a string.',
        );
        const resolvedDryRun = resolveOptionalBoolean(dryRun, 'INVALID_DRY_RUN', 'dryRun must be a boolean.');

        if (typeof intent !== 'string') {
            throw createAppError(400, 'INVALID_APPEND_INTENT', 'Append intent must be a string.');
        }

        if (typeof insertion !== 'string') {
            throw createAppError(400, 'INVALID_APPEND_INSERTION', 'Append insertion must be a string.');
        }

        const result = await appendMarkdown({
            id: noteId,
            expectedUpdatedAt: resolvedExpectedUpdatedAt,
            baseMarkdownSha256: resolvedBaseMarkdownSha256,
            intent,
            insertion,
            placement: resolveAppendPlacement(placement),
            separator: resolveSeparator(separator),
            policy: resolveMarkdownWritePolicy(policy),
            dryRun: resolvedDryRun,
        });

        if (result.status === 'applied') {
            emitEvent({
                type: 'mcp.note.updated',
                source: 'mcp',
                noteId: result.note.id,
                updatedAt: result.note.updatedAt,
            });
        }

        res.status(200).json(result).end();
    };
};

export const createMcpReplaceNoteMarkdownHandler = (
    replaceMarkdown = replaceNoteMarkdown,
    emitEvent: EmitServerEvent = emitServerEvent,
): Controller => {
    return async (req, res) => {
        const { id, expectedUpdatedAt, baseMarkdownSha256, intent, replacement, policy, dryRun } = req.body ?? {};
        const noteId = resolvePositiveNoteId(id);
        const resolvedExpectedUpdatedAt = resolveOptionalString(
            expectedUpdatedAt,
            'INVALID_NOTE_VERSION',
            'expectedUpdatedAt must be a string.',
        );
        const resolvedBaseMarkdownSha256 = resolveOptionalString(
            baseMarkdownSha256,
            'INVALID_MARKDOWN_HASH',
            'baseMarkdownSha256 must be a string.',
        );
        const resolvedDryRun = resolveOptionalBoolean(dryRun, 'INVALID_DRY_RUN', 'dryRun must be a boolean.');

        if (typeof intent !== 'string') {
            throw createAppError(400, 'INVALID_REPLACE_INTENT', 'Replace intent must be a string.');
        }

        if (typeof replacement !== 'string') {
            throw createAppError(400, 'INVALID_REPLACE_MARKDOWN', 'Replacement markdown must be a string.');
        }

        const result = await replaceMarkdown({
            id: noteId,
            expectedUpdatedAt: resolvedExpectedUpdatedAt,
            baseMarkdownSha256: resolvedBaseMarkdownSha256,
            intent,
            replacement,
            policy: resolveMarkdownWritePolicy(policy),
            dryRun: resolvedDryRun,
        });

        if (result.status === 'applied') {
            emitEvent({
                type: 'mcp.note.updated',
                source: 'mcp',
                noteId: result.note.id,
                updatedAt: result.note.updatedAt,
            });
        }

        res.status(200).json(result).end();
    };
};

export const createMcpUpdateNoteMetadataHandler = (
    updateMetadata = updateNoteMetadata,
    emitEvent: EmitServerEvent = emitServerEvent,
): Controller => {
    return async (req, res) => {
        const { id, expectedUpdatedAt, title, layout, dryRun } = req.body ?? {};
        const noteId = resolvePositiveNoteId(id);
        const resolvedLayout = resolveNoteLayout(layout);
        const resolvedDryRun = resolveOptionalBoolean(dryRun, 'INVALID_DRY_RUN', 'dryRun must be a boolean.');

        if (typeof expectedUpdatedAt !== 'string') {
            throw createAppError(400, 'INVALID_NOTE_VERSION', 'expectedUpdatedAt must be a string.');
        }

        if (title !== undefined && typeof title !== 'string') {
            throw createAppError(400, 'INVALID_NOTE_TITLE', 'Note title must be a string.');
        }

        if (layout !== undefined && resolvedLayout === null) {
            throw createAppError(400, 'INVALID_NOTE_LAYOUT', 'Note layout must be one of narrow, wide, or full.');
        }

        if (title === undefined && layout === undefined) {
            throw createAppError(400, 'INVALID_NOTE_INPUT', 'At least one metadata field must be provided.');
        }

        const result = await updateMetadata({
            id: noteId,
            expectedUpdatedAt,
            ...(title !== undefined ? { title } : {}),
            ...(resolvedLayout ? { layout: resolvedLayout } : {}),
            dryRun: resolvedDryRun,
        });

        if (result.status === 'applied') {
            emitEvent({
                type: 'mcp.note.updated',
                source: 'mcp',
                noteId: result.note.id,
                updatedAt: result.note.updatedAt,
            });
        }

        res.status(200).json(result).end();
    };
};

export const createMcpDeleteNoteHandler = (
    deleteNote = deleteNoteById,
    emitEvent: EmitServerEvent = emitServerEvent,
): Controller => {
    return async (req, res) => {
        const id = Number(req.body?.id);

        if (!Number.isInteger(id) || id <= 0) {
            throw createAppError(400, 'INVALID_NOTE_ID', 'A valid note id is required.');
        }

        const deletedNote = await deleteNote(id);

        if (!deletedNote) {
            throw createAppError(404, 'NOTE_NOT_FOUND', 'The requested note was not found.');
        }

        emitEvent({
            type: 'mcp.note.deleted',
            source: 'mcp',
            noteId: deletedNote.id,
        });

        res.status(200)
            .json({
                deleted: true,
                note: deletedNote,
            })
            .end();
    };
};
