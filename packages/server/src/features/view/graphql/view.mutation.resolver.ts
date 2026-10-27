import type { IResolvers } from '@graphql-tools/utils';
import { GraphQLError } from 'graphql';
import { createNoteFromMarkdown, InvalidNoteAuthoringInputError } from '~/features/note/services/authoring.js';
import { emitNoteChange } from '~/features/note/services/change-events.js';
import { InvalidNotePropertyInputError, type NotePropertySetByKeyInput } from '~/features/note/services/properties.js';
import {
    createView,
    createViewGroup,
    deleteView,
    deleteViewGroup,
    reorderViewGroups,
    reorderViews,
    setActiveViewGroup,
    updateView,
    updateViewGroup,
    type ViewInput,
} from '~/features/view/services/workspace.js';
import models from '~/models.js';
import type { NoteViewContextInput } from '../services/note-creation.js';

type ViewMutationResolvers = NonNullable<IResolvers['Mutation']>;

export const viewMutationResolvers = {
    createNoteInView: async (
        _,
        {
            viewId,
            groupValue,
            input,
        }: {
            viewId: string;
            groupValue?: string | null;
            input: {
                title: string;
                tagNames?: string[];
                properties?: NotePropertySetByKeyInput[];
                deletePropertyKeys?: string[];
            };
        },
    ) => {
        try {
            const viewContext: NoteViewContextInput = {
                viewId,
                ...(groupValue !== undefined ? { groupValue } : {}),
                ...(input.tagNames ? { tagNames: input.tagNames } : {}),
            };
            const created = await createNoteFromMarkdown({
                title: input.title,
                viewContext,
                ...(input.properties?.length || input.deletePropertyKeys?.length
                    ? { properties: { set: input.properties, deleteKeys: input.deletePropertyKeys } }
                    : {}),
            });
            const note = await models.note.findUniqueOrThrow({ where: { id: Number(created.id) } });
            emitNoteChange({ type: 'note.created', noteId: note.id });
            return note;
        } catch (error) {
            if (error instanceof InvalidNotePropertyInputError || error instanceof InvalidNoteAuthoringInputError)
                throw new GraphQLError(error.message, { extensions: { code: 'INVALID_VIEW_NOTE_INPUT' } });
            throw error;
        }
    },
    createViewGroup: async (_, { title }: { title: string }) => {
        return createViewGroup(title);
    },
    updateViewGroup: async (_, { id, title }: { id: string; title: string }) => {
        return updateViewGroup(id, title);
    },
    deleteViewGroup: async (_, { id }: { id: string }) => {
        return deleteViewGroup(id);
    },
    setActiveViewGroup: async (_, { id }: { id: string }) => {
        return setActiveViewGroup(id);
    },
    reorderViewGroups: async (_, { groupIds }: { groupIds: string[] }) => {
        return reorderViewGroups(groupIds);
    },
    createView: async (
        _,
        {
            groupId,
            input,
        }: {
            groupId: string;
            input: ViewInput;
        },
    ) => {
        return createView(groupId, input);
    },
    updateView: async (
        _,
        {
            id,
            input,
        }: {
            id: string;
            input: ViewInput;
        },
    ) => {
        return updateView(id, input);
    },
    deleteView: async (_, { id }: { id: string }) => {
        return deleteView(id);
    },
    reorderViews: async (
        _,
        {
            groupId,
            viewIds,
        }: {
            groupId: string;
            viewIds: string[];
        },
    ) => {
        return reorderViews(groupId, viewIds);
    },
} satisfies ViewMutationResolvers;
