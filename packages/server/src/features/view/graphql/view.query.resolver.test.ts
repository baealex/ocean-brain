import assert from 'node:assert/strict';
import test from 'node:test';
import { GraphQLError } from 'graphql';

import { InvalidNotePropertyInputError } from '~/features/note/services/properties.js';
import { createViewQueryResolvers, type ViewQueryResolverDeps } from './view.query.resolver.js';

type QueryResolver = (_: unknown, args: Record<string, unknown>) => Promise<unknown>;
const getQueryResolver = (resolvers: unknown, field: string) => {
    return (resolvers as Record<string, unknown>)[field] as QueryResolver;
};

const createDeps = (overrides: Partial<ViewQueryResolverDeps> = {}): ViewQueryResolverDeps => ({
    getNotesByProperties: async () => ({ totalCount: 0, notes: [] }),
    getViewBoardColumn: async () => ({ totalCount: 0, notes: [] }),
    getViewById: async () => null,
    getViewCalendarNotes: async () => [],
    getViewNotes: async () => ({ totalCount: 0, notes: [] }),
    getViewWorkspace: async () => ({ activeGroupId: null, groups: [] }),
    ...overrides,
});

test('viewNotes applies default pagination at the GraphQL boundary', async () => {
    let receivedPagination: unknown;
    const resolvers = createViewQueryResolvers(
        createDeps({
            getViewNotes: async (_id, pagination) => {
                receivedPagination = pagination;
                return { totalCount: 0, notes: [] };
            },
        }),
    );
    const resolveViewNotes = getQueryResolver(resolvers, 'viewNotes');

    const result = await resolveViewNotes(null, { id: 'view-1' });

    assert.deepEqual(receivedPagination, { limit: 25, offset: 0 });
    assert.deepEqual(result, { totalCount: 0, notes: [] });
});

test('viewBoardColumn maps invalid property input to a stable GraphQL error code', async () => {
    const resolvers = createViewQueryResolvers(
        createDeps({
            getViewBoardColumn: async () => {
                throw new InvalidNotePropertyInputError('Unknown board property');
            },
        }),
    );
    const resolveBoardColumn = getQueryResolver(resolvers, 'viewBoardColumn');

    await assert.rejects(
        () => resolveBoardColumn(null, { id: 'view-1' }),
        (error) =>
            error instanceof GraphQLError &&
            error.message === 'Unknown board property' &&
            error.extensions.code === 'INVALID_NOTE_PROPERTY_INPUT',
    );
});

test('viewCalendarNotes maps invalid calendar input to a stable GraphQL error code', async () => {
    const resolvers = createViewQueryResolvers(
        createDeps({
            getViewCalendarNotes: async () => {
                throw new InvalidNotePropertyInputError('Invalid calendar range');
            },
        }),
    );
    const resolveCalendarNotes = getQueryResolver(resolvers, 'viewCalendarNotes');

    await assert.rejects(
        () =>
            resolveCalendarNotes(null, {
                id: 'view-1',
                dateRange: { start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z' },
            }),
        (error) =>
            error instanceof GraphQLError &&
            error.message === 'Invalid calendar range' &&
            error.extensions.code === 'INVALID_NOTE_PROPERTY_INPUT',
    );
});

test('notesByProperties normalizes numeric pagination before calling the service', async () => {
    let receivedPagination: unknown;
    const resolvers = createViewQueryResolvers(
        createDeps({
            getNotesByProperties: async (_input, pagination) => {
                receivedPagination = pagination;
                return { totalCount: 0, notes: [] };
            },
        }),
    );
    const resolveNotesByProperties = getQueryResolver(resolvers, 'notesByProperties');

    await resolveNotesByProperties(null, {
        input: {},
        pagination: { limit: '12', offset: '24' },
    });

    assert.deepEqual(receivedPagination, { limit: 12, offset: 24 });
});
