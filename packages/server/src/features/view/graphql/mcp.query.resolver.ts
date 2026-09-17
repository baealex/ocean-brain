import type { IResolvers } from '@graphql-tools/utils';
import { GraphQLError } from 'graphql';
import { InvalidNotePropertyInputError } from '~/features/note/services/properties.js';
import { listViewSections, type ReadViewSectionInput, readViewSection } from '../services/mcp-read.js';
import { getNotesByQuery, type ViewNotesQueryInput } from '../services/workspace.js';

const queryResult = async <T>(read: () => Promise<T>): Promise<T> => {
    try {
        return await read();
    } catch (error) {
        if (error instanceof InvalidNotePropertyInputError) {
            throw new GraphQLError(error.message, { extensions: { code: 'INVALID_NOTE_PROPERTY_INPUT' } });
        }
        throw error;
    }
};

export const mcpViewQueryResolvers = {
    notesByQuery: (
        _: unknown,
        { input, pagination }: { input: ViewNotesQueryInput; pagination?: { limit?: number; offset?: number } },
    ) => queryResult(() => getNotesByQuery(input, pagination)),
    viewSections: (
        _: unknown,
        { query, pagination }: { query?: string; pagination?: { limit?: number; offset?: number } },
    ) => queryResult(() => listViewSections(query, pagination)),
    readViewSection: (_: unknown, input: ReadViewSectionInput) => queryResult(() => readViewSection(input)),
} satisfies NonNullable<IResolvers['Query']>;
