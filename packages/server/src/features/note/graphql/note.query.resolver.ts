import type { IResolvers } from '@graphql-tools/utils';
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
import { getNoteSnapshot, listNoteSnapshots } from '~/features/note/services/snapshot.js';
import {
    buildNoteTagNamesWhere,
    type NoteTagMatchMode,
    normalizeNoteTagNames,
} from '~/features/note/services/tag-filter.js';
import { getTrashedNoteById, listTrashedNotes } from '~/features/note/services/trash.js';
import type { Note, Prisma } from '~/models.js';
import models from '~/models.js';
import { runDataMaintenanceInBackground } from '~/modules/data-maintenance.js';
import type { Pagination, SearchFilter } from '~/types/index.js';

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
        }: {
            searchFilter: SearchFilter;
            pagination: Pagination;
        },
    ) => {
        const orderBy = buildAllNotesOrderBy(searchFilter);
        const limit = Number(pagination.limit);
        const offset = Number(pagination.offset);
        const where = buildAllNotesSearchWhere(searchFilter);

        if (!where) {
            const [notes, totalCount] = await Promise.all([
                deps.findNotes({
                    orderBy,
                    take: limit,
                    skip: offset,
                }),
                deps.countNotes({}),
            ]);

            return {
                totalCount,
                notes,
            };
        }

        const staleCandidateNotes = await deps.findNotes({
            orderBy,
            where: buildAllNotesStaleCandidateWhere(searchFilter),
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
        findCandidateNotes: (noteId) =>
            models.note.findMany({
                orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
                where: {
                    NOT: { id: noteId },
                },
            }),
    },
) => {
    return async (_: unknown, { id }: { id: string }) => {
        const notes = await deps.findCandidateNotes(Number(id));

        return notes.filter((note) => contentReferencesNote(note.content, id));
    };
};

interface NoteGraphQueryResolverDeps {
    findNotes: () => Promise<Array<Pick<Note, 'id' | 'title' | 'content'>>>;
}

export const createNoteGraphQueryResolver = (
    deps: NoteGraphQueryResolverDeps = {
        findNotes: () =>
            models.note.findMany({
                select: {
                    id: true,
                    title: true,
                    content: true,
                },
            }),
    },
) => {
    return async () => {
        const notes = await deps.findNotes();

        return buildNoteGraph(notes);
    };
};

export const noteQueryResolvers: NoteQueryResolvers = {
    allNotes: createAllNotesQueryResolver(),
    notesInDateRange: async (
        _,
        {
            dateRange,
        }: {
            dateRange: {
                start: string;
                end: string;
            };
        },
    ) => {
        const where: Prisma.NoteWhereInput = {
            OR: [
                {
                    updatedAt: {
                        gte: new Date(dateRange.start),
                        lte: new Date(dateRange.end),
                    },
                },
                {
                    createdAt: {
                        gte: new Date(dateRange.start),
                        lte: new Date(dateRange.end),
                    },
                },
            ],
        };

        return models.note.findMany({
            orderBy: { createdAt: 'asc' },
            where,
        });
    },
    tagNotes: async (
        _,
        {
            searchFilter,
            pagination,
        }: {
            searchFilter: SearchFilter;
            pagination: Pagination;
        },
    ) => {
        const where: Prisma.NoteWhereInput = { tags: { some: { id: Number(searchFilter.query) } } };
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
            tagNames,
            mode,
            pagination,
        }: {
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

        const where = buildNoteTagNamesWhere(normalizedTagNames, mode);
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
    pinnedNotes: async () =>
        models.note.findMany({
            orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
            where: { pinned: true },
        }),
    imageNotes: async (_, { src }: { src: string }) =>
        models.note.findMany({
            orderBy: { updatedAt: 'desc' },
            where: { content: { contains: src } },
        }),
    backReferences: createBackReferencesQueryResolver(),
    note: async (_, { id }: { id: string }) => {
        const note = await models.note.findUnique({ where: { id: Number(id) } });

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
                    .filter((referenceId): referenceId is string => referenceId !== null)
                    .map(Number)
                    .filter(Number.isFinite),
            ),
        );
        const references = await models.note.findMany({ where: { id: { in: referenceIds } } });
        const titlesById = new Map(
            references.map((referenceNote: Note) => [String(referenceNote.id), referenceNote.title]),
        );
        const newContent = syncReferenceTitlesInContent(note.content, titlesById);

        if (!newContent || newContent === note.content) {
            return note;
        }

        try {
            return await models.note.update({
                where: {
                    id: note.id,
                    updatedAt: note.updatedAt,
                },
                data: {
                    content: newContent,
                    ...buildNoteSearchProjection({
                        title: note.title,
                        content: newContent,
                    }),
                },
            });
        } catch (error) {
            if (isRecordNotFoundError(error)) {
                return note;
            }

            throw error;
        }
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
    notePropertyKeys: async (
        _,
        {
            query,
            pagination = {
                limit: 50,
                offset: 0,
            },
        }: {
            query?: string;
            pagination: Pagination;
        },
    ) => {
        return listNotePropertyKeys({
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
            pagination = {
                limit: 25,
                offset: 0,
            },
        }: {
            pagination: Pagination;
        },
    ) => {
        return listTrashedNotes({
            limit: Number(pagination.limit),
            offset: Number(pagination.offset),
        });
    },
    noteGraph: createNoteGraphQueryResolver(),
};
