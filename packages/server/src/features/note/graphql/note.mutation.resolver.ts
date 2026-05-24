import type { IResolvers } from '@graphql-tools/utils';
import type { Request } from 'express';
import { buildNoteSearchProjection } from '~/features/note/services/search.js';
import {
    captureNoteBaseline,
    createSnapshotMetaFromUserAgent,
    restoreNoteSnapshot,
} from '~/features/note/services/snapshot.js';
import { purgeTrashedNoteById, restoreTrashedNoteById, trashNoteById } from '~/features/note/services/trash.js';
import { assertExpectedNoteVersion } from '~/features/note/services/write-conflict.js';
import models from '~/models.js';
import type { NoteInput } from '~/types/index.js';
import { extractBlocksByType, parseNoteContent } from './note.graphql.shared.js';

const PLACEHOLDER_PREFIX = '{%';
const PLACEHOLDER_SUFFIX = '%}';

const replacePlaceholders = async (content: string) => {
    const placeholders = content.matchAll(new RegExp(`${PLACEHOLDER_PREFIX}([^}]+)${PLACEHOLDER_SUFFIX}`, 'g'));
    const resolvedPlaceholders = await models.placeholder.findMany({
        select: {
            template: true,
            replacement: true,
        },
        where: { template: { in: Array.from(new Set(Array.from(placeholders, (match) => match[1]))) } },
    });

    let replacedContent = content;

    for (const placeholder of resolvedPlaceholders) {
        replacedContent = replacedContent.replace(
            new RegExp(`${PLACEHOLDER_PREFIX}${placeholder.template}${PLACEHOLDER_SUFFIX}`, 'g'),
            placeholder.replacement,
        );
    }

    return replacedContent;
};

const getRequestUserAgent = (req?: Request) => {
    const userAgentHeader = req?.headers['user-agent'];
    return Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
};

const toTagConnections = (blocks: Array<{ props?: { id?: string | number } }>) => {
    return blocks
        .map((block) => block.props?.id)
        .filter((id) => id !== undefined && id !== null && String(id).trim() !== '')
        .map((id) => Number(id))
        .filter(Number.isFinite)
        .map((id) => ({ id }));
};

type NoteMutationResolvers = NonNullable<IResolvers['Mutation']>;
type CreateNoteInput = Required<Pick<NoteInput, 'title' | 'content'>> & Pick<NoteInput, 'layout'>;

export const noteMutationResolvers: NoteMutationResolvers = {
    createNote: async (_, { note }: { note: CreateNoteInput }) => {
        const replacedTitle = await replacePlaceholders(note.title);
        const replacedContent = await replacePlaceholders(note.content);
        const createdNote = await models.note.create({
            data: {
                title: replacedTitle,
                content: replacedContent,
                ...buildNoteSearchProjection({
                    title: replacedTitle,
                    content: replacedContent,
                }),
                ...(note.layout && { layout: note.layout }),
            },
        });

        if (!replacedContent) {
            return createdNote;
        }

        const blocks = extractBlocksByType<{ id: string }>('tag', JSON.parse(replacedContent));

        return models.note.update({
            where: { id: createdNote.id },
            data: { tags: { set: toTagConnections(blocks) } },
        });
    },
    updateNote: async (
        _,
        {
            id,
            note,
            editSessionId,
            expectedUpdatedAt,
        }: {
            id: number;
            note: NoteInput;
            editSessionId?: string;
            expectedUpdatedAt?: string;
        },
        context: {
            req?: Request;
        },
    ) => {
        const existingNote = await models.note.findUnique({
            where: { id: Number(id) },
            select: {
                title: true,
                content: true,
                updatedAt: true,
            },
        });

        if (!existingNote) {
            throw 'NOT FOUND';
        }

        assertExpectedNoteVersion({
            expectedUpdatedAt,
            currentUpdatedAt: existingNote.updatedAt,
        });

        const parsedContent = note.content ? parseNoteContent(note.content) : null;
        const blocks = parsedContent ? extractBlocksByType<{ id: string }>('tag', parsedContent) : [];

        await captureNoteBaseline({
            noteId: Number(id),
            ...(editSessionId ? { editSessionId } : {}),
            meta: createSnapshotMetaFromUserAgent(getRequestUserAgent(context.req)),
        });

        const nextTitle = note.title ?? existingNote.title;
        const nextContent = note.content ?? existingNote.content;

        return models.note.update({
            where: { id: Number(id) },
            data: {
                ...(note.title !== undefined ? { title: note.title } : {}),
                ...(note.content !== undefined ? { content: note.content } : {}),
                ...(note.layout !== undefined ? { layout: note.layout } : {}),
                ...buildNoteSearchProjection({
                    title: nextTitle,
                    content: nextContent,
                }),
                ...(note.content ? { tags: { set: toTagConnections(blocks) } } : {}),
            },
        });
    },
    deleteNote: async (_, { id }: { id: string }) => {
        const trashedNote = await trashNoteById(Number(id));

        if (!trashedNote) {
            throw 'NOT FOUND';
        }

        return true;
    },
    restoreNoteSnapshot: async (
        _,
        { id }: { id: string },
        context: {
            req?: Request;
        },
    ) => {
        const note = await restoreNoteSnapshot(Number(id), {
            meta: createSnapshotMetaFromUserAgent(getRequestUserAgent(context.req)),
        });

        if (!note) {
            throw 'NOT FOUND';
        }

        return note;
    },
    restoreTrashedNote: async (_, { id }: { id: string }) => {
        const note = await restoreTrashedNoteById(Number(id));

        if (!note) {
            throw 'NOT FOUND';
        }

        return note;
    },
    purgeTrashedNote: async (_, { id }: { id: string }) => {
        const purgedNote = await purgeTrashedNoteById(Number(id));

        if (!purgedNote) {
            throw 'NOT FOUND';
        }

        return true;
    },
    pinNote: (_, { id, pinned }: { id: string; pinned: boolean }) =>
        models.note.update({
            where: { id: Number(id) },
            data: { pinned: Boolean(pinned) },
        }),
    reorderNotes: async (_, { notes }: { notes: Array<{ id: string; order: number }> }) => {
        const updatePromises = notes.map(({ id, order }) =>
            models.note.update({
                where: { id: Number(id) },
                data: { order },
            }),
        );

        return Promise.all(updatePromises);
    },
};
