import type { IResolvers } from '@graphql-tools/utils';
import { extractBackReferenceContexts } from '~/features/note/services/back-reference-context.js';
import { emitNoteChange } from '~/features/note/services/change-events.js';
import { getNoteCleanupPreview, listNoteCleanupCandidates } from '~/features/note/services/cleanup.js';
import {
    buildNoteGraph,
    contentReferencesNote,
    extractReferenceBlocksFromContent,
    normalizeReferenceId,
    syncReferenceTitlesInContent,
} from '~/features/note/services/content-blocks.js';
import { listNotePropertyKeys } from '~/features/note/services/properties.js';
import {
    buildNoteSearchProjection,
    filterNotesBySearchQuery,
    NOTE_SEARCH_TEXT_SCHEMA_VERSION,
    parseNoteSearchQuery,
} from '~/features/note/services/search.js';
import { diffNoteSnapshot, getNoteSnapshot, listNoteSnapshots } from '~/features/note/services/snapshot.js';
import {
    buildNoteTagNamesWhere,
    type NoteTagMatchMode,
    normalizeNoteTagNames,
} from '~/features/note/services/tag-filter.js';
import { getTrashedNoteById, listTrashedNotes } from '~/features/note/services/trash.js';
import { resolveWorkspaceWhere, type WorkspaceScopeInput } from '~/features/workspace/scope.js';
import type { Note, Prisma } from '~/models.js';
import models from '~/models.js';
import { runDataMaintenanceInBackground } from '~/modules/data-maintenance.js';
import type { Pagination, SearchFilter } from '~/types/index.js';
import { type MarkdownReadInput, readMarkdownRange } from '../services/markdown-read.js';

interface AllNotesResolverDeps {
    countNotes: (args: { where?: Prisma.NoteWhereInput }) => Promise<number>;
    findNotes: (args: {
        orderBy: Prisma.NoteOrderByWithRelationInput[];
        where?: Prisma.NoteWhereInput;
        take?: number;
        skip?: number;
    }) => Promise<Note[]>;
    triggerSearchBackfill: () => void;
}

const MAX_SQLITE_INT_ID = 2_147_483_647;

const isValidNoteIdString = (id: string) => {
    if (!/^[1-9]\d*$/.test(id)) {
        return false;
    }

    const numericId = Number(id);

    return Number.isSafeInteger(numericId) && numericId <= MAX_SQLITE_INT_ID;
};

interface NoteResolverDeps {
    findNote: (id: number) => Promise<Note | null>;
    findReferenceNotes: (ids: number[]) => Promise<Note[]>;
    updateNoteContent: (input: {
        id: number;
        updatedAt: Date;
        content: string;
        searchableText: string;
        searchableTextVersion: number;
    }) => Promise<Note>;
    isRecordNotFoundError: (error: unknown) => boolean;
}

const buildAllNotesOrderBy = (searchFilter: SearchFilter) => {
    const sortBy = searchFilter.sortBy || 'updatedAt';
    const sortOrder = searchFilter.sortOrder || 'desc';
    const pinnedFirst = searchFilter.pinnedFirst || false;
    const orderBy: Prisma.NoteOrderByWithRelationInput[] = [];

    if (pinnedFirst) {
        orderBy.push({ pinned: 'desc' });
    }

    if (sortBy === 'createdAt') {
        orderBy.push({ createdAt: sortOrder as 'asc' | 'desc' });
    } else {
        orderBy.push({ updatedAt: sortOrder as 'asc' | 'desc' });
    }

    return orderBy;
};

const buildAllNotesSearchWhere = (searchFilter: SearchFilter) => {
    const parsedQuery = parseNoteSearchQuery(searchFilter.query);

    if (!parsedQuery.hasFilters) {
        return undefined;
    }

    return {
        AND: [
            { searchableTextVersion: NOTE_SEARCH_TEXT_SCHEMA_VERSION },
            ...parsedQuery.included.map((keyword) => ({ searchableText: { contains: keyword } })),
            ...parsedQuery.excluded.map((keyword) => ({ NOT: { searchableText: { contains: keyword } } })),
        ],
    } satisfies Prisma.NoteWhereInput;
};

const buildAllNotesStaleCandidateWhere = (searchFilter: SearchFilter) => {
    const parsedQuery = parseNoteSearchQuery(searchFilter.query);

    return {
        AND: [
            { searchableTextVersion: { not: NOTE_SEARCH_TEXT_SCHEMA_VERSION } },
            ...parsedQuery.included.map((keyword) => ({
                OR: [{ title: { contains: keyword } }, { content: { contains: keyword } }],
            })),
        ],
    } satisfies Prisma.NoteWhereInput;
};

const compareNotesForSearch = (left: Note, right: Note, searchFilter: SearchFilter) => {
    if (searchFilter.pinnedFirst && left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1;
    }

    const sortBy = searchFilter.sortBy || 'updatedAt';
    const sortOrder = searchFilter.sortOrder || 'desc';
    const leftValue = sortBy === 'createdAt' ? left.createdAt.getTime() : left.updatedAt.getTime();
    const rightValue = sortBy === 'createdAt' ? right.createdAt.getTime() : right.updatedAt.getTime();

    if (leftValue === rightValue) {
        return 0;
    }

    return sortOrder === 'asc' ? leftValue - rightValue : rightValue - leftValue;
};

const mergeSortedNotesForSearch = (left: Note[], right: Note[], searchFilter: SearchFilter) => {
    const merged: Note[] = [];
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < left.length && rightIndex < right.length) {
        if (compareNotesForSearch(left[leftIndex], right[rightIndex], searchFilter) <= 0) {
            merged.push(left[leftIndex]);
            leftIndex += 1;
        } else {
            merged.push(right[rightIndex]);
            rightIndex += 1;
        }
    }

    while (leftIndex < left.length) {
        merged.push(left[leftIndex]);
        leftIndex += 1;
    }

    while (rightIndex < right.length) {
        merged.push(right[rightIndex]);
        rightIndex += 1;
    }

    return merged;
};

const isRecordNotFoundError = (error: unknown) => {
    return (
        typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'P2025'
    );
};

export const createAllNotesQueryResolver = (
    deps: AllNotesResolverDeps = {
        countNotes: ({ where }) => models.note.count({ where }),
        findNotes: ({ orderBy, where, take, skip }) =>
            models.note.findMany({
                orderBy,
                where,
                take,
                skip,
            }),
        triggerSearchBackfill: () => {
            void runDataMaintenanceInBackground();
        },
    },
) => {
    return async (
        _: unknown,
        {
            searchFilter,
            pagination,
            scope,
        }: {
            searchFilter: SearchFilter;
            pagination: Pagination;
            scope?: WorkspaceScopeInput;
        },
    ) => {
        const orderBy = buildAllNotesOrderBy(searchFilter);
        const limit = Number(pagination.limit);
        const offset = Number(pagination.offset);
        const workspaceWhere = await resolveWorkspaceWhere(scope);
        const searchWhere = buildAllNotesSearchWhere(searchFilter);
        const where = scope ? { ...workspaceWhere, ...searchWhere } : searchWhere;

        if (!searchWhere) {
            const [notes, totalCount] = await Promise.all([
                deps.findNotes({
                    orderBy,
                    ...(scope ? { where } : {}),
                    take: limit,
                    skip: offset,
                }),
                deps.countNotes(scope ? { where } : {}),
            ]);

            return {
                totalCount,
                notes,
            };
        }

        const staleCandidateNotes = await deps.findNotes({
            orderBy,
            where: { ...workspaceWhere, ...buildAllNotesStaleCandidateWhere(searchFilter) },
        });

        if (staleCandidateNotes.length === 0) {
            const [notes, totalCount] = await Promise.all([
                deps.findNotes({
                    orderBy,
                    where,
                    take: limit,
                    skip: offset,
                }),
                deps.countNotes({ where }),
            ]);

            return {
                totalCount,
                notes,
            };
        }

        deps.triggerSearchBackfill();

        const parsedQuery = parseNoteSearchQuery(searchFilter.query);
        const staleNotes = filterNotesBySearchQuery(staleCandidateNotes, parsedQuery);

        if (staleNotes.length === 0) {
            const [notes, totalCount] = await Promise.all([
                deps.findNotes({
                    orderBy,
                    where,
                    take: limit,
                    skip: offset,
                }),
                deps.countNotes({ where }),
            ]);

            return {
                totalCount,
                notes,
            };
        }

        const [freshNotesPrefix, freshTotalCount] = await Promise.all([
            deps.findNotes({
                orderBy,
                where,
                take: offset + limit,
            }),
            deps.countNotes({ where }),
        ]);

        const mergedNotes = mergeSortedNotesForSearch(freshNotesPrefix, staleNotes, searchFilter);

        return {
            totalCount: freshTotalCount + staleNotes.length,
            notes: mergedNotes.slice(offset, offset + limit),
        };
    };
};

type NoteQueryResolvers = NonNullable<IResolvers['Query']>;

interface BackReferencesQueryResolverDeps {
    findCandidateNotes: (noteId: number) => Promise<Note[]>;
}

export const createBackReferencesQueryResolver = (
    deps: BackReferencesQueryResolverDeps = {
        findCandidateNotes: async (noteId) => {
            const references = await models.noteReference.findMany({
                where: { targetNoteId: noteId },
                select: { sourceNoteId: true },
            });

            if (references.length === 0) {
                return [];
            }

            return models.note.findMany({
                orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
                where: {
                    id: { in: references.map((reference) => reference.sourceNoteId) },
                    NOT: { id: noteId },
                },
            });
        },
    },
) => {
    return async (_: unknown, { id }: { id: string }) => {
        const notes = await deps.findCandidateNotes(Number(id));

        return notes.filter((note) => contentReferencesNote(note.content, id));
    };
};

interface BackReferenceDetailsDeps {
    findSourceIds: (noteId: number) => Promise<number[]>;
    findNotes: (
        ids: number[],
        pagination: { take: number; skip: number },
    ) => Promise<Pick<Note, 'id' | 'title' | 'content'>[]>;
}

export const createBackReferenceDetailsQueryResolver =
    (
        deps: BackReferenceDetailsDeps = {
            findSourceIds: async (noteId) =>
                (
                    await models.noteReference.findMany({
                        where: { targetNoteId: noteId, NOT: { sourceNoteId: noteId } },
                        select: { sourceNoteId: true },
                    })
                ).map((reference) => reference.sourceNoteId),
            findNotes: (ids, pagination) =>
                models.note.findMany({
                    where: { id: { in: ids } },
                    select: { id: true, title: true, content: true },
                    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
                    ...pagination,
                }),
        },
    ) =>
    async (_: unknown, { id, limit = 20, offset = 0 }: { id: string; limit?: number; offset?: number }) => {
        const empty = { references: [], hasMore: false, nextOffset: null };
        if (!isValidNoteIdString(id)) return empty;
        const take = Number.isInteger(limit) ? Math.min(50, Math.max(1, limit)) : 20;
        const skip = Number.isInteger(offset) ? Math.max(0, offset) : 0;
        const ids = await deps.findSourceIds(Number(id));
        if (ids.length === 0) return empty;
        const notes = await deps.findNotes(ids, { take: take + 1, skip });
        const hasMore = notes.length > take;
        const references = notes.slice(0, take).flatMap((note) => {
            const result = extractBackReferenceContexts(note.content, id);
            return result.contexts.length
                ? [
                      {
                          id: note.id,
                          title: note.title,
                          contexts: result.contexts,
                          hasMoreContexts: result.hasMore,
                      },
                  ]
                : [];
        });
        return { references, hasMore, nextOffset: hasMore ? skip + take : null };
    };

interface NoteGraphQueryResolverDeps {
    findNotes: (args: {
        where?: Prisma.NoteWhereInput;
        orderBy: Array<{ id: 'asc' }>;
        select: {
            id: true;
            title: true;
            updatedAt: true;
            tags: {
                orderBy: Array<{ name: 'asc' }>;
                select: { id: true; name: true };
            };
        };
    }) => Promise<
        Array<
            Pick<Note, 'id' | 'title' | 'updatedAt'> & {
                tags: Array<{ id: number; name: string }>;
            }
        >
    >;
    findReferences: (args: {
        orderBy: Array<{ sourceNoteId: 'asc' } | { targetNoteId: 'asc' }>;
        select: { sourceNoteId: true; targetNoteId: true };
    }) => Promise<Array<{ sourceNoteId: number; targetNoteId: number }>>;
}

export const createNoteGraphQueryResolver = (
    deps: NoteGraphQueryResolverDeps = {
        findNotes: (args) => models.note.findMany(args),
        findReferences: (args) => models.noteReference.findMany(args),
    },
) => {
    return async (_?: unknown, { scope }: { scope?: WorkspaceScopeInput } = {}) => {
        const where = await resolveWorkspaceWhere(scope);
        const [notes, references] = await Promise.all([
            deps.findNotes({
                ...(scope ? { where } : {}),
                orderBy: [{ id: 'asc' }],
                select: {
                    id: true,
                    title: true,
                    updatedAt: true,
                    tags: {
                        orderBy: [{ name: 'asc' }],
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            deps.findReferences({
                orderBy: [{ sourceNoteId: 'asc' }, { targetNoteId: 'asc' }],
                select: {
                    sourceNoteId: true,
                    targetNoteId: true,
                },
            }),
        ]);

        return buildNoteGraph(notes, references);
    };
};

export const createNoteQueryResolver = (
    deps: NoteResolverDeps = {
        findNote: (id) => models.note.findUnique({ where: { id } }),
        findReferenceNotes: (ids) => models.note.findMany({ where: { id: { in: ids } } }),
        updateNoteContent: ({ id, updatedAt, content, searchableText, searchableTextVersion }) =>
            models.note.update({
                where: {
                    id,
                    updatedAt,
                },
                data: {
                    content,
                    searchableText,
                    searchableTextVersion,
                },
            }),
        isRecordNotFoundError,
    },
) => {
    return async (_: unknown, { id }: { id: string }) => {
        const note = await deps.findNote(Number(id));

        if (!note) {
            throw 'NOT FOUND';
        }

        if (!note.content) {
            return note;
        }

        const blocks = extractReferenceBlocksFromContent(note.content);

        if (blocks.length === 0) {
            return note;
        }

        const referenceIds = Array.from(
            new Set(
                blocks
                    .map((block) => normalizeReferenceId(block.props?.id))
                    .filter(
                        (referenceId): referenceId is string =>
                            referenceId !== null && isValidNoteIdString(referenceId),
                    )
                    .map(Number),
            ),
        );
        const references = await deps.findReferenceNotes(referenceIds);
        const titlesById = new Map(
            references.map((referenceNote: Note) => [String(referenceNote.id), referenceNote.title]),
        );
        const newContent = syncReferenceTitlesInContent(note.content, titlesById);

        if (!newContent || newContent === note.content) {
            return note;
        }

        try {
            const updatedNote = await deps.updateNoteContent({
                id: note.id,
                updatedAt: note.updatedAt,
                content: newContent,
                ...buildNoteSearchProjection({
                    title: note.title,
                    content: newContent,
                }),
            });
            emitNoteChange({ type: 'note.updated', noteId: updatedNote.id });
            return updatedNote;
        } catch (error) {
            if (deps.isRecordNotFoundError(error)) {
                return note;
            }

            throw error;
        }
    };
};

export const buildNotesInDateRangeWhere = (dateRange: { start: string; end: string }): Prisma.NoteWhereInput => ({
    OR: [
        {
            updatedAt: {
                gte: new Date(dateRange.start),
                lt: new Date(dateRange.end),
            },
        },
        {
            createdAt: {
                gte: new Date(dateRange.start),
                lt: new Date(dateRange.end),
            },
        },
    ],
});

export const noteQueryResolvers: NoteQueryResolvers = {
    allNotes: createAllNotesQueryResolver(),
    notesInDateRange: async (
        _,
        {
            scope,
            dateRange,
        }: {
            scope?: WorkspaceScopeInput;
            dateRange: {
                start: string;
                end: string;
            };
        },
    ) => {
        const where = { ...(await resolveWorkspaceWhere(scope)), ...buildNotesInDateRangeWhere(dateRange) };

        return models.note.findMany({
            orderBy: { createdAt: 'asc' },
            where,
        });
    },
    tagNotes: async (
        _,
        {
            scope,
            searchFilter,
            pagination,
        }: {
            scope?: WorkspaceScopeInput;
            searchFilter: SearchFilter;
            pagination: Pagination;
        },
    ) => {
        const where: Prisma.NoteWhereInput = {
            ...(await resolveWorkspaceWhere(scope)),
            tags: { some: { id: Number(searchFilter.query) } },
        };
        const notes = models.note.findMany({
            orderBy: { updatedAt: 'desc' },
            where,
            take: Number(pagination.limit),
            skip: Number(pagination.offset),
        });

        return {
            totalCount: models.note.count({ where }),
            notes,
        };
    },
    notesByTagNames: async (
        _,
        {
            scope,
            tagNames,
            mode,
            pagination,
        }: {
            scope?: WorkspaceScopeInput;
            tagNames: string[];
            mode: NoteTagMatchMode;
            pagination: Pagination;
        },
    ) => {
        const normalizedTagNames = normalizeNoteTagNames(tagNames);

        if (normalizedTagNames.length === 0) {
            return {
                totalCount: 0,
                notes: [],
            };
        }

        const where = { ...(await resolveWorkspaceWhere(scope)), ...buildNoteTagNamesWhere(normalizedTagNames, mode) };
        const notes = models.note.findMany({
            orderBy: { updatedAt: 'desc' },
            where,
            take: Number(pagination.limit),
            skip: Number(pagination.offset),
        });

        return {
            totalCount: models.note.count({ where }),
            notes,
        };
    },
    pinnedNotes: async (_, { scope }: { scope?: WorkspaceScopeInput } = {}) =>
        models.note.findMany({
            orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
            where: { ...(await resolveWorkspaceWhere(scope)), pinned: true },
        }),
    imageNotes: async (_, { src }: { src: string }) =>
        models.note.findMany({
            orderBy: { updatedAt: 'desc' },
            where: { content: { contains: src } },
        }),
    backReferences: createBackReferencesQueryResolver(),
    backReferenceDetails: createBackReferenceDetailsQueryResolver(),
    note: createNoteQueryResolver(),
    noteRead: async (_: unknown, { id, ...input }: MarkdownReadInput & { id: string }) => {
        const note = await createNoteQueryResolver()(_, { id });
        const { blocksToMarkdown } = await import('~/modules/blocknote.js');
        return { note, ...readMarkdownRange(await blocksToMarkdown(note.content), note.updatedAt, input) };
    },
    noteCleanupCandidates: async (
        _,
        {
            query,
            pagination = {
                limit: 20,
                offset: 0,
            },
        }: {
            query?: string;
            pagination: Pagination;
        },
    ) => {
        const result = await listNoteCleanupCandidates({
            keywords: query
                ? query
                      .split(/[,\s]+/)
                      .map((keyword) => keyword.trim())
                      .filter(Boolean)
                : undefined,
            limit: Number(pagination.limit),
            offset: Number(pagination.offset),
        });

        return result.notes;
    },
    noteCleanupPreview: async (_, { id }: { id: string }) => {
        return getNoteCleanupPreview(Number(id));
    },
    noteSnapshots: async (
        _,
        {
            id,
            limit = 10,
        }: {
            id: string;
            limit?: number;
        },
    ) => {
        return listNoteSnapshots(Number(id), Number(limit));
    },
    noteSnapshot: async (_, { id }: { id: string }) => {
        return getNoteSnapshot(Number(id));
    },
    noteSnapshotDiff: async (
        _,
        {
            id,
            compareToSnapshotId,
            target,
            contextLines,
        }: {
            id: string;
            compareToSnapshotId?: string;
            target?: 'NEXT' | 'PREVIOUS' | 'CURRENT';
            contextLines?: number | null;
        },
    ) => {
        const normalizedContextLines = contextLines ?? 3;

        if (normalizedContextLines < 0 || normalizedContextLines > 20) {
            throw new Error('INVALID_SNAPSHOT_DIFF_CONTEXT_LINES');
        }

        return diffNoteSnapshot(Number(id), {
            ...(compareToSnapshotId !== undefined ? { compareToSnapshotId: Number(compareToSnapshotId) } : {}),
            ...(target !== undefined ? { target: target.toLowerCase() as 'next' | 'previous' | 'current' } : {}),
            contextLines: normalizedContextLines,
        });
    },
    notePropertyKeys: async (
        _,
        {
            scope,
            query,
            pagination = {
                limit: 50,
                offset: 0,
            },
        }: {
            scope?: WorkspaceScopeInput;
            query?: string;
            pagination: Pagination;
        },
    ) => {
        return listNotePropertyKeys({
            scope,
            query,
            limit: Number(pagination.limit),
            offset: Number(pagination.offset),
        });
    },
    trashedNote: async (_, { id }: { id: string }) => {
        return getTrashedNoteById(Number(id));
    },
    trashedNotes: async (
        _,
        {
            scope,
            pagination = {
                limit: 25,
                offset: 0,
            },
        }: {
            pagination: Pagination;
            scope?: WorkspaceScopeInput;
        },
    ) => {
        const where = await resolveWorkspaceWhere(scope);
        return listTrashedNotes({
            workspaceId: where.workspaceId,
            limit: Number(pagination.limit),
            offset: Number(pagination.offset),
        });
    },
    noteGraph: createNoteGraphQueryResolver(),
};
