import type { IResolvers } from '@graphql-tools/utils';
import { GraphQLError } from 'graphql';
import { InvalidNotePropertyInputError } from '~/features/note/services/properties.js';
import {
    getNotesByProperties,
    getViewSectionBoardColumn,
    getViewSectionById,
    getViewSectionNotes,
    getViewWorkspace,
    type ViewNotesQueryInput,
} from '~/features/view/services/workspace.js';
import type { Pagination } from '~/types/index.js';

type ViewQueryResolvers = NonNullable<IResolvers['Query']>;

export const viewQueryResolvers: ViewQueryResolvers = {
    viewWorkspace: async () => {
        return getViewWorkspace();
    },
    viewSection: async (_, { id }: { id: string }) => {
        return getViewSectionById(id);
    },
    viewSectionNotes: async (
        _,
        {
            id,
            pagination = {
                limit: 25,
                offset: 0,
            },
            sortBy,
            sortOrder,
        }: {
            id: string;
            pagination: Pagination;
            sortBy?: ViewNotesQueryInput['sortBy'];
            sortOrder?: ViewNotesQueryInput['sortOrder'];
        },
    ) => {
        const sectionNotes = await getViewSectionNotes(
            id,
            {
                limit: Number(pagination.limit),
                offset: Number(pagination.offset),
            },
            { sortBy, sortOrder },
        );

        if (!sectionNotes) {
            throw 'NOT FOUND';
        }

        return sectionNotes;
    },
    viewSectionBoardColumn: async (
        _,
        {
            id,
            optionValue = null,
            pagination = {
                limit: 5,
                offset: 0,
            },
        }: {
            id: string;
            optionValue?: string | null;
            pagination?: Pagination;
        },
    ) => {
        try {
            const columnNotes = await getViewSectionBoardColumn(id, optionValue, {
                limit: Number(pagination.limit),
                offset: Number(pagination.offset),
            });

            if (!columnNotes) {
                throw 'NOT FOUND';
            }

            return columnNotes;
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
    notesByProperties: async (
        _,
        {
            input,
            pagination = {
                limit: 20,
                offset: 0,
            },
        }: {
            input: ViewNotesQueryInput;
            pagination: Pagination;
        },
    ) => {
        try {
            return await getNotesByProperties(input, {
                limit: Number(pagination.limit),
                offset: Number(pagination.offset),
            });
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
};
