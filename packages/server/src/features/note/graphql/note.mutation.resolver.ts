import type { IResolvers } from '@graphql-tools/utils';
import type { Request } from 'express';
import { buildNoteSearchProjection } from '~/features/note/services/search.js';
import {
    captureNoteBaseline,
    createSnapshotMetaFromUserAgent,
    restoreNoteSnapshot,
} from '~/features/note/services/snapshot.js';
import { restoreTrashedNoteById, trashNoteById } from '~/features/note/services/trash.js';
import models from '~/models.js';
import type { NoteInput } from '~/types/index.js';
import { extractBlocksByType } from './note.graphql.shared.js';

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

type NoteMutationResolvers = NonNullable<IResolvers['Mutation']>;

export const noteMutationResolvers: NoteMutationResolvers = {
    createNote: async (_, { note }: { note: NoteInput }) => {
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
            data: { tags: { set: blocks.map((block) => ({ id: Number(block.props.id) })) } },
        });
    },
    updateNote: async (
        _,
        {
            id,
            note,
            editSessionId,
        }: {
            id: number;
            note: NoteInput;
            editSessionId?: string;
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
            },
        });

        if (!existingNote) {
            throw 'NOT FOUND';
        }

        const blocks = note.content ? extractBlocksByType<{ id: string }>('tag', JSON.parse(note.content)) : [];

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
                ...note,
                ...buildNoteSearchProjection({
                    title: nextTitle,
                    content: nextContent,
                }),
                ...(note.content ? { tags: { set: blocks.map((block) => ({ id: Number(block.props.id) })) } } : {}),
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
