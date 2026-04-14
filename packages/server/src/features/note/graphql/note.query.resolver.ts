import type { IResolvers } from '@graphql-tools/utils';
import { getNoteCleanupPreview, listNoteCleanupCandidates } from '~/features/note/services/cleanup.js';
import {
    filterNotesBySearchQuery,
    NOTE_SEARCH_TEXT_SCHEMA_VERSION,
    parseNoteSearchQuery,
} from '~/features/note/services/search.js';
import { listNoteSnapshots } from '~/features/note/services/snapshot.js';
import {
    buildNoteTagNamesWhere,
    type NoteTagMatchMode,
    normalizeNoteTagNames,
} from '~/features/note/services/tag-filter.js';
import { listTrashedNotes } from '~/features/note/services/trash.js';
import type { Note, Prisma } from '~/models.js';
import models from '~/models.js';
import { runDataMaintenanceInBackground } from '~/modules/data-maintenance.js';
import type { Pagination, SearchFilter } from '~/types/index.js';
import { extractBlocksByType } from './note.graphql.shared.js';

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
    backReferences: async (_, { id }: { id: string }) => {
        return models.note.findMany({
            orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
            where: { content: { contains: `reference","props":{"id":"${id}"` } },
        });
    },
    note: async (_, { id }: { id: string }) => {
        const note = await models.note.findUnique({ where: { id: Number(id) } });

        if (!note) {
            throw 'NOT FOUND';
        }

        if (!note.content) {
            return note;
        }

        const blocks = extractBlocksByType<{
            id: string;
            title: string;
        }>('reference', JSON.parse(note.content));

        if (blocks.length === 0) {
            return note;
        }

        const referenceIds = blocks.map((block) => Number(block.props.id));
        const references = await models.note.findMany({ where: { id: { in: referenceIds } } });
        const newContent = references.reduce<string>((content, referenceNote: Note) => {
            const reference = blocks.find((block) => Number(block.props.id) === referenceNote.id);

            if (reference && reference.props.title !== referenceNote.title) {
                return content.replace(
                    `reference","props":{"id":"${reference.props.id}","title":"${reference.props.title}"`,
                    `reference","props":{"id":"${referenceNote.id}","title":"${referenceNote.title}"`,
                );
            }

            return content;
        }, note.content);

        if (newContent === note.content) {
            return note;
        }

        try {
            JSON.parse(newContent);

            return await models.note.update({
                where: { id: note.id },
                data: { content: newContent },
            });
        } catch {
            // Keep the stored content unchanged if the synchronized payload becomes invalid.
            return note;
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
            limit = 5,
        }: {
            id: string;
            limit?: number;
        },
    ) => {
        return listNoteSnapshots(Number(id), Number(limit));
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
    noteGraph: async () => {
        const notes = await models.note.findMany({
            select: {
                id: true,
                title: true,
                content: true,
            },
        });

        const nodes: Array<{ id: string; title: string; connections: number }> = [];
        const links: Array<{ source: string; target: string }> = [];
        const connectionCount: Record<string, number> = {};
        const linkSet = new Set<string>();

        for (const note of notes) {
            if (!note.content) {
                continue;
            }

            try {
                const blocks = extractBlocksByType<{ id: string }>('reference', JSON.parse(note.content));

                for (const block of blocks) {
                    const targetId = block.props.id;

                    if (targetId && String(note.id) !== targetId) {
                        const linkKey = `${note.id}-${targetId}`;
                        const reverseLinkKey = `${targetId}-${note.id}`;

                        if (!linkSet.has(linkKey) && !linkSet.has(reverseLinkKey)) {
                            linkSet.add(linkKey);
                            links.push({
                                source: String(note.id),
                                target: targetId,
                            });
                            connectionCount[String(note.id)] = (connectionCount[String(note.id)] || 0) + 1;
                            connectionCount[targetId] = (connectionCount[targetId] || 0) + 1;
                        }
                    }
                }
            } catch {
                // Skip notes with invalid JSON content
            }
        }

        for (const note of notes) {
            nodes.push({
                id: String(note.id),
                title: note.title || 'Untitled',
                connections: connectionCount[String(note.id)] || 0,
            });
        }

        return {
            nodes,
            links,
        };
    },
};
