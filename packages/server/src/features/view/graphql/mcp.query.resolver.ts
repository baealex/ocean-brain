import type { IResolvers } from '@graphql-tools/utils';
import { GraphQLError } from 'graphql';
import { InvalidNotePropertyInputError } from '~/features/note/services/properties.js';
import { listViews, type ReadViewInput, readView } from '../services/mcp-read.js';
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
    views: (_: unknown, { query, pagination }: { query?: string; pagination?: { limit?: number; offset?: number } }) =>
        queryResult(() => listViews(query, pagination)),
    readView: (_: unknown, input: ReadViewInput) => queryResult(() => readView(input)),
} satisfies NonNullable<IResolvers['Query']>;
