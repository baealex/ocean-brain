import type { IResolvers } from '@graphql-tools/utils';
import type { Request } from 'express';
import { GraphQLError } from 'graphql';
import { extractBlocksByType, parseNoteContent } from '~/features/note/services/content-blocks.js';
import {
    createNotePropertyDefinition,
    deleteNotePropertyDefinition,
    InvalidNotePropertyInputError,
    type NotePropertiesPatchInput,
    type NotePropertyDefinitionInput,
    type NotePropertyDefinitionUpdateInput,
    NotePropertyDeleteConfirmationRequiredError,
    updateNotePropertiesWithVersionGuard,
    updateNotePropertyDefinition,
} from '~/features/note/services/properties.js';
import { buildNoteSearchProjection } from '~/features/note/services/search.js';
import { createSnapshotMetaFromUserAgent, restoreNoteSnapshot } from '~/features/note/services/snapshot.js';
import { purgeTrashedNoteById, restoreTrashedNoteById, trashNoteById } from '~/features/note/services/trash.js';
import { updateNoteWithVersionGuard } from '~/features/note/services/write.js';
import {
    isInvalidNoteVersionError,
    isMissingNoteVersionError,
    isNoteVersionConflictError,
} from '~/features/note/services/write-conflict.js';
import models from '~/models.js';
import type { NoteInput } from '~/types/index.js';

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

const parseRequiredNoteContent = (content: string) => {
    const parsedContent = parseNoteContent(content);

    if (!parsedContent) {
        throw new GraphQLError('Note content must be valid BlockNote JSON.', {
            extensions: {
                code: 'INVALID_NOTE_CONTENT',
            },
        });
    }

    return parsedContent;
};

type NoteMutationResolvers = NonNullable<IResolvers['Mutation']>;
type CreateNoteInput = Required<Pick<NoteInput, 'title' | 'content'>> & Pick<NoteInput, 'layout'>;

export const noteMutationResolvers: NoteMutationResolvers = {
    createNote: async (_, { note }: { note: CreateNoteInput }) => {
        const replacedTitle = await replacePlaceholders(note.title);
        const replacedContent = await replacePlaceholders(note.content);
        const parsedContent = replacedContent ? parseRequiredNoteContent(replacedContent) : null;
        const blocks = parsedContent ? extractBlocksByType<{ id: string }>('tag', parsedContent) : [];
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
            force,
        }: {
            id: number;
            note: NoteInput;
            editSessionId?: string;
            expectedUpdatedAt?: string;
            force?: boolean;
        },
        context: {
            req?: Request;
        },
    ) => {
        const parsedContent = note.content ? parseRequiredNoteContent(note.content) : null;
        const blocks = parsedContent ? extractBlocksByType<{ id: string }>('tag', parsedContent) : [];
        try {
            const updatedNote = await updateNoteWithVersionGuard({
                id: Number(id),
                data: {
                    ...(note.title !== undefined ? { title: note.title } : {}),
                    ...(note.content !== undefined ? { content: note.content } : {}),
                    ...(note.layout !== undefined ? { layout: note.layout } : {}),
                    ...(note.content !== undefined ? { tagIds: toTagConnections(blocks).map((tag) => tag.id) } : {}),
                },
                ...(editSessionId ? { editSessionId } : {}),
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(force ? { force: true } : {}),
                snapshotMeta: createSnapshotMetaFromUserAgent(getRequestUserAgent(context.req)),
            });

            if (!updatedNote) {
                throw 'NOT FOUND';
            }

            return updatedNote;
        } catch (error) {
            if (isNoteVersionConflictError(error)) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: error.code,
                        currentUpdatedAt: error.currentUpdatedAt,
                        expectedUpdatedAt: error.expectedUpdatedAt,
                    },
                });
            }

            if (isInvalidNoteVersionError(error)) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: error.code,
                    },
                });
            }

            if (isMissingNoteVersionError(error)) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: error.code,
                    },
                });
            }

            throw error;
        }
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
    createNotePropertyKey: async (_, { input }: { input: NotePropertyDefinitionInput }) => {
        try {
            return await createNotePropertyDefinition(input);
        } catch (error) {
            if (error instanceof InvalidNotePropertyInputError) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: 'INVALID_NOTE_PROPERTY_INPUT',
                    },
                });
            }

            throw error;
        }
    },
    updateNotePropertyKey: async (_, { key, input }: { key: string; input: NotePropertyDefinitionUpdateInput }) => {
        try {
            const result = await updateNotePropertyDefinition({ key, input });

            if (!result) {
                throw 'NOT FOUND';
            }

            return result;
        } catch (error) {
            if (error instanceof InvalidNotePropertyInputError) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: 'INVALID_NOTE_PROPERTY_INPUT',
                    },
                });
            }

            throw error;
        }
    },
    deleteNotePropertyKey: async (_, { key, confirmImpact }: { key: string; confirmImpact?: boolean }) => {
        try {
            const result = await deleteNotePropertyDefinition({ key, confirmImpact });

            if (!result) {
                throw 'NOT FOUND';
            }

            return result;
        } catch (error) {
            if (error instanceof InvalidNotePropertyInputError) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: 'INVALID_NOTE_PROPERTY_INPUT',
                    },
                });
            }

            if (error instanceof NotePropertyDeleteConfirmationRequiredError) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: error.code,
                        affectedNoteCount: error.affectedNoteCount,
                    },
                });
            }

            throw error;
        }
    },
    updateNoteProperties: async (
        _,
        {
            id,
            patch,
            editSessionId,
            expectedUpdatedAt,
            force,
        }: {
            id: string;
            patch: NotePropertiesPatchInput;
            editSessionId?: string;
            expectedUpdatedAt?: string;
            force?: boolean;
        },
    ) => {
        try {
            const note = await updateNotePropertiesWithVersionGuard({
                id: Number(id),
                patch,
                ...(editSessionId ? { editSessionId } : {}),
                ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
                ...(force ? { force: true } : {}),
            });

            if (!note) {
                throw 'NOT FOUND';
            }

            return note;
        } catch (error) {
            if (error instanceof InvalidNotePropertyInputError) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: 'INVALID_NOTE_PROPERTY_INPUT',
                    },
                });
            }

            if (isNoteVersionConflictError(error)) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: error.code,
                        currentUpdatedAt: error.currentUpdatedAt,
                        expectedUpdatedAt: error.expectedUpdatedAt,
                    },
                });
            }

            if (isInvalidNoteVersionError(error)) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: error.code,
                    },
                });
            }

            if (isMissingNoteVersionError(error)) {
                throw new GraphQLError(error.message, {
                    extensions: {
                        code: error.code,
                    },
                });
            }

            throw error;
        }
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
