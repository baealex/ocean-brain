import type { IResolvers } from '@graphql-tools/utils';
import { GraphQLError } from 'graphql';
import { InvalidNotePropertyInputError } from '~/features/note/services/properties.js';
import {
    getNotesByProperties,
    getViewSectionBoardColumn,
    getViewSectionById,
    getViewSectionCalendarNotes,
    getViewSectionNotes,
    getViewWorkspace,
    type ViewCalendarDateRangeInput,
    type ViewNotesQueryInput,
} from '~/features/view/services/workspace.js';
import type { Pagination } from '~/types/index.js';

type ViewQueryResolvers = NonNullable<IResolvers['Query']>;

export interface ViewQueryResolverDeps {
    getNotesByProperties: typeof getNotesByProperties;
    getViewSectionBoardColumn: typeof getViewSectionBoardColumn;
    getViewSectionById: typeof getViewSectionById;
    getViewSectionCalendarNotes: typeof getViewSectionCalendarNotes;
    getViewSectionNotes: typeof getViewSectionNotes;
    getViewWorkspace: typeof getViewWorkspace;
}

export const createViewQueryResolvers = (
    deps: ViewQueryResolverDeps = {
        getNotesByProperties,
        getViewSectionBoardColumn,
        getViewSectionById,
        getViewSectionCalendarNotes,
        getViewSectionNotes,
        getViewWorkspace,
    },
): ViewQueryResolvers => ({
    viewWorkspace: async () => {
        return deps.getViewWorkspace();
    },
    viewSection: async (_, { id }: { id: string }) => {
        return deps.getViewSectionById(id);
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
        const sectionNotes = await deps.getViewSectionNotes(
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
    viewSectionCalendarNotes: async (_, { id, dateRange }: { id: string; dateRange: ViewCalendarDateRangeInput }) => {
        try {
            const notes = await deps.getViewSectionCalendarNotes(id, dateRange);

            if (!notes) {
                throw 'NOT FOUND';
            }

            return notes;
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
            const columnNotes = await deps.getViewSectionBoardColumn(id, optionValue, {
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
            return await deps.getNotesByProperties(input, {
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
});

export const viewQueryResolvers = createViewQueryResolvers();
