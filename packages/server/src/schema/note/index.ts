import type { IResolvers } from '@graphql-tools/utils';
import type { Request } from 'express';

import models from '~/models.js';
import { gql } from '~/modules/graphql.js';
import {
    getNoteCleanupPreview,
    listNoteCleanupCandidates
} from '~/modules/note-cleanup.js';
import {
    captureNoteBaseline,
    createSnapshotMetaFromUserAgent,
    listNoteSnapshots,
    restoreNoteSnapshot
} from '~/modules/note-snapshot.js';
import {
    listTrashedNotes,
    restoreTrashedNoteById,
    trashNoteById
} from '~/modules/note-trash.js';
import {
    buildNoteSearchProjection,
    filterNotesBySearchQuery,
    NOTE_SEARCH_TEXT_SCHEMA_VERSION,
    parseNoteSearchQuery
} from '~/modules/note-search.js';
import { runDataMaintenanceInBackground } from '~/modules/data-maintenance.js';
import { buildNoteTagNamesWhere, normalizeNoteTagNames, type NoteTagMatchMode } from '~/modules/note-tag-filter.js';

import type { Note, Prisma } from '~/models.js';
import type { Pagination, SearchFilter, NoteInput } from '~/types/index.js';

export const noteType = gql`
    input PaginationInput {
        limit: Int!
        offset: Int!
    }

    input SearchFilterInput {
        query: String!
        sortBy: String
        sortOrder: String
        pinnedFirst: Boolean
    }

    input DateRangeInput {
        start: String!
        end: String!
    }

    enum NoteLayout {
        narrow
        wide
        full
    }

    enum TagMatchMode {
        and
        or
    }

    input NoteInput {
        title: String
        content: String
        layout: NoteLayout
    }

    input NoteOrderInput {
        id: ID!
        order: Int!
    }

    type Tag {
        id: ID!
        name: String!
        createdAt: String!
        updatedAt: String!
    }

    type Note {
        id: ID!
        title: String!
        content: String!
        contentAsMarkdown: String!
        createdAt: String!
        updatedAt: String!
        pinned: Boolean!
        order: Int!
        layout: NoteLayout!
        tags: [Tag!]!
    }

    type Notes {
        totalCount: Int!
        notes: [Note!]!
    }

    type NoteCleanupBackReference {
        id: ID!
        title: String!
    }

    type NoteCleanupCandidate {
        id: ID!
        title: String!
        updatedAt: String!
        pinned: Boolean!
        tagNames: [String!]!
        reminderCount: Int!
        backReferenceCount: Int!
        matchedTerms: [String!]!
        reasons: [String!]!
        requiresForce: Boolean!
        forceReasons: [String!]!
    }

    type NoteCleanupPreview {
        id: ID!
        title: String!
        updatedAt: String!
        pinned: Boolean!
        tagNames: [String!]!
        reminderCount: Int!
        backReferences: [NoteCleanupBackReference!]!
        orphanedTagNames: [String!]!
        requiresForce: Boolean!
        forceReasons: [String!]!
    }

    type NoteSnapshotMeta {
        entrypoint: String
        label: String
    }

    type NoteSnapshot {
        id: ID!
        title: String!
        createdAt: String!
        meta: NoteSnapshotMeta!
    }

    type DeletedNote {
        id: ID!
        title: String!
        createdAt: String!
        updatedAt: String!
        deletedAt: String!
        pinned: Boolean!
        order: Int!
        layout: NoteLayout!
        tagNames: [String!]!
    }

    type DeletedNotes {
        totalCount: Int!
        notes: [DeletedNote!]!
    }
`;

export const noteQuery = gql`
    type GraphNode {
        id: ID!
        title: String!
        connections: Int!
    }

    type GraphLink {
        source: ID!
        target: ID!
    }

    type NoteGraph {
        nodes: [GraphNode!]!
        links: [GraphLink!]!
    }

    type Query {
        allNotes(searchFilter: SearchFilterInput, pagination: PaginationInput): Notes!
        tagNotes(searchFilter: SearchFilterInput, pagination: PaginationInput): Notes!
        notesByTagNames(tagNames: [String!]!, mode: TagMatchMode!, pagination: PaginationInput): Notes!
        notesInDateRange(dateRange: DateRangeInput): [Note!]!
        pinnedNotes: [Note!]!
        imageNotes(src: String!): [Note!]!
        backReferences(id: ID!): [Note]!
        note(id: ID!): Note!
        noteCleanupCandidates(query: String, pagination: PaginationInput): [NoteCleanupCandidate!]!
        noteCleanupPreview(id: ID!): NoteCleanupPreview
        noteSnapshots(id: ID!, limit: Int): [NoteSnapshot!]!
        trashedNotes(pagination: PaginationInput): DeletedNotes!
        noteGraph: NoteGraph!
    }
`;

export const noteMutation = gql`
    type Mutation {
        createNote(note: NoteInput!): Note!
        updateNote(id: ID!, note: NoteInput!, editSessionId: String): Note!
        deleteNote(id: ID!): Boolean!
        restoreNoteSnapshot(id: ID!): Note!
        restoreTrashedNote(id: ID!): Note!
        pinNote(id: ID!, pinned: Boolean!): Note!
        reorderNotes(notes: [NoteOrderInput!]!): [Note!]!
    }
`;

export const noteTypeDefs = `
    ${noteType}
    ${noteQuery}
    ${noteMutation}
`;

interface BlockNote<T = unknown> {
    id: string;
    type: string;
    props: T;
    content?: BlockNote<T>[];
    children?: BlockNote<T>[];
}

const extractBlocksByType = <T>(type: string, dataArray: BlockNote[]): BlockNote<T>[] => {
    let result: BlockNote[] = [];

    for (const data of dataArray) {
        if (data.type === type) {
            result.push(data);
        }

        if (data.children && data.children.length > 0) {
            result = result.concat(extractBlocksByType(type, data.children));
        }

        if (data.content && data.content.length > 0) {
            for (const contentItem of data.content) {
                if (contentItem.type === type) {
                    result.push(contentItem);
                }
            }
        }
    }

    return result as unknown as BlockNote<T>[];
};

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
            ...parsedQuery.excluded.map((keyword) => ({ NOT: { searchableText: { contains: keyword } } }))
        ]
    } satisfies Prisma.NoteWhereInput;
};

const buildAllNotesStaleCandidateWhere = (searchFilter: SearchFilter) => {
    const parsedQuery = parseNoteSearchQuery(searchFilter.query);

    return {
        AND: [
            { searchableTextVersion: { not: NOTE_SEARCH_TEXT_SCHEMA_VERSION } },
            ...parsedQuery.included.map((keyword) => ({
                OR: [
                    { title: { contains: keyword } },
                    { content: { contains: keyword } }
                ]
            }))
        ]
    } satisfies Prisma.NoteWhereInput;
};

const compareNotesForSearch = (left: Note, right: Note, searchFilter: SearchFilter) => {
    if (searchFilter.pinnedFirst && left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1;
    }

    const sortBy = searchFilter.sortBy || 'updatedAt';
    const sortOrder = searchFilter.sortOrder || 'desc';
    const leftValue = sortBy === 'createdAt'
        ? left.createdAt.getTime()
        : left.updatedAt.getTime();
    const rightValue = sortBy === 'createdAt'
        ? right.createdAt.getTime()
        : right.updatedAt.getTime();

    if (leftValue === rightValue) {
        return 0;
    }

    return sortOrder === 'asc'
        ? leftValue - rightValue
        : rightValue - leftValue;
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
        findNotes: ({ orderBy, where, take, skip }) => models.note.findMany({
            orderBy,
            where,
            take,
            skip
        }),
        triggerSearchBackfill: () => {
            void runDataMaintenanceInBackground();
        }
    }
) => {
    return async (_: unknown, {
        searchFilter,
        pagination
    }: {
        searchFilter: SearchFilter;
        pagination: Pagination;
    }) => {
        const orderBy = buildAllNotesOrderBy(searchFilter);
        const limit = Number(pagination.limit);
        const offset = Number(pagination.offset);
        const where = buildAllNotesSearchWhere(searchFilter);

        if (!where) {
            const [notes, totalCount] = await Promise.all([
                deps.findNotes({
                    orderBy,
                    take: limit,
                    skip: offset
                }),
                deps.countNotes({})
            ]);

            return {
                totalCount,
                notes
            };
        }

        const staleCandidateNotes = await deps.findNotes({
            orderBy,
            where: buildAllNotesStaleCandidateWhere(searchFilter)
        });

        if (staleCandidateNotes.length === 0) {
            const [notes, totalCount] = await Promise.all([
                deps.findNotes({
                    orderBy,
                    where,
                    take: limit,
                    skip: offset
                }),
                deps.countNotes({ where })
            ]);

            return {
                totalCount,
                notes
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
                    skip: offset
                }),
                deps.countNotes({ where })
            ]);

            return {
                totalCount,
                notes
            };
        }

        const [freshNotesPrefix, freshTotalCount] = await Promise.all([
            deps.findNotes({
                orderBy,
                where,
                take: offset + limit
            }),
            deps.countNotes({ where })
        ]);
        const mergedNotes = mergeSortedNotesForSearch(freshNotesPrefix, staleNotes, searchFilter);

        return {
            totalCount: freshTotalCount + staleNotes.length,
            notes: mergedNotes.slice(offset, offset + limit)
        };
    };
};

export const noteResolvers: IResolvers = {
    Query: {
        allNotes: createAllNotesQueryResolver(),
        notesInDateRange: async (_, { dateRange }: {
            dateRange: {
                start: string;
                end: string;
            };
        }) => {
            const where: Prisma.NoteWhereInput = {
                OR: [
                    {
                        updatedAt: {
                            gte: new Date(dateRange.start),
                            lte: new Date(dateRange.end)
                        }
                    },
                    {
                        createdAt: {
                            gte: new Date(dateRange.start),
                            lte: new Date(dateRange.end)
                        }
                    }
                ]
            };

            const $notes = await models.note.findMany({
                orderBy: { createdAt: 'asc' },
                where
            });

            return $notes;
        },
        tagNotes: async (_, {
            searchFilter,
            pagination
        }: {
            searchFilter: SearchFilter;
            pagination: Pagination;
        }) => {
            const where: Prisma.NoteWhereInput = { tags: { some: { id: Number(searchFilter.query) } } };

            const $notes = models.note.findMany({
                orderBy: { updatedAt: 'desc' },
                where,
                take: Number(pagination.limit),
                skip: Number(pagination.offset)
            });
            return {
                totalCount: models.note.count({ where }),
                notes: $notes
            };
        },
        notesByTagNames: async (_, {
            tagNames,
            mode,
            pagination
        }: {
            tagNames: string[];
            mode: NoteTagMatchMode;
            pagination: Pagination;
        }) => {
            const normalizedTagNames = normalizeNoteTagNames(tagNames);

            if (normalizedTagNames.length === 0) {
                return {
                    totalCount: 0,
                    notes: []
                };
            }

            const where = buildNoteTagNamesWhere(normalizedTagNames, mode);

            const $notes = models.note.findMany({
                orderBy: { updatedAt: 'desc' },
                where,
                take: Number(pagination.limit),
                skip: Number(pagination.offset)
            });

            return {
                totalCount: models.note.count({ where }),
                notes: $notes
            };
        },
        pinnedNotes: async () => models.note.findMany({
            orderBy: [
                { order: 'asc' },
                { updatedAt: 'desc' }
            ],
            where: { pinned: true }
        }),
        imageNotes: async (_, { src }) => models.note.findMany({
            orderBy: { updatedAt: 'desc' },
            where: { content: { contains: src } }
        }),
        backReferences: async (_, { id }: Note) => {
            return models.note.findMany({
                orderBy: [
                    { pinned: 'desc' },
                    { updatedAt: 'desc' }
                ],
                where: { content: { contains: `reference","props":{"id":"${id}"` } }
            });
        },
        note: async (_, { id }: Note) => {
            const $note = await models.note.findUnique({ where: { id: Number(id) } });
            if (!$note) {
                throw 'NOT FOUND';
            }
            if ($note.content) {
                const blocks = extractBlocksByType<{
                    id: string;
                    title: string;
                }>('reference', JSON.parse($note.content));
                if (blocks.length > 0) {
                    const referenceIds = blocks.map(block => Number(block.props.id));
                    const $references = await models.note.findMany({ where: { id: { in: referenceIds } } });
                    const newContent = $references.reduce<string>((acc: string, $reference: Note) => {
                        const reference = blocks.find(block => Number(block.props.id) === $reference.id);
                        if (reference && reference.props.title !== $reference.title) {
                            return acc.replace(
                                `reference","props":{"id":"${reference.props.id}","title":"${reference.props.title}"`,
                                `reference","props":{"id":"${$reference.id}","title":"${$reference.title}"`
                            );
                        }
                        return acc;
                    }, $note.content);
                    if (newContent !== $note.content) {
                        try {
                            JSON.parse(newContent);
                            return await models.note.update({
                                where: { id: $note.id },
                                data: { content: newContent }
                            });
                        } catch {
                            // Keep the stored content unchanged if the synchronized payload becomes invalid.
                        }
                    }
                }
            }
            return $note;
        },
        noteCleanupCandidates: async (_, {
            query,
            pagination = {
                limit: 20,
                offset: 0
            }
        }: {
            query?: string;
            pagination: Pagination;
        }) => {
            const result = await listNoteCleanupCandidates({
                keywords: query
                    ? query.split(/[,\s]+/).map((keyword) => keyword.trim()).filter(Boolean)
                    : undefined,
                limit: Number(pagination.limit),
                offset: Number(pagination.offset)
            });

            return result.notes;
        },
        noteCleanupPreview: async (_, { id }: { id: string }) => {
            return getNoteCleanupPreview(Number(id));
        },
        noteSnapshots: async (_, {
            id,
            limit = 5
        }: {
            id: string;
            limit?: number;
        }) => {
            return listNoteSnapshots(Number(id), Number(limit));
        },
        trashedNotes: async (_, {
            pagination = {
                limit: 25,
                offset: 0
            }
        }: {
            pagination: Pagination;
        }) => {
            return listTrashedNotes({
                limit: Number(pagination.limit),
                offset: Number(pagination.offset)
            });
        },
        noteGraph: async () => {
            const $notes = await models.note.findMany({
                select: {
                    id: true,
                    title: true,
                    content: true
                }
            });

            const nodes: Array<{ id: string; title: string; connections: number }> = [];
            const links: Array<{ source: string; target: string }> = [];
            const connectionCount: Record<string, number> = {};
            const linkSet = new Set<string>();

            // Extract all references from each note
            for (const $note of $notes) {
                if ($note.content) {
                    try {
                        const blocks = extractBlocksByType<{ id: string }>('reference', JSON.parse($note.content));
                        for (const block of blocks) {
                            const targetId = block.props.id;
                            // Avoid self-references and duplicate links
                            if (targetId && String($note.id) !== targetId) {
                                const linkKey = `${$note.id}-${targetId}`;
                                const reverseLinkKey = `${targetId}-${$note.id}`;
                                if (!linkSet.has(linkKey) && !linkSet.has(reverseLinkKey)) {
                                    linkSet.add(linkKey);
                                    links.push({
                                        source: String($note.id),
                                        target: targetId
                                    });
                                    // Count connections for both nodes
                                    connectionCount[String($note.id)] = (connectionCount[String($note.id)] || 0) + 1;
                                    connectionCount[targetId] = (connectionCount[targetId] || 0) + 1;
                                }
                            }
                        }
                    } catch {
                        // Skip notes with invalid JSON content
                    }
                }
            }

            // Build nodes array with connection counts
            for (const $note of $notes) {
                nodes.push({
                    id: String($note.id),
                    title: $note.title || 'Untitled',
                    connections: connectionCount[String($note.id)] || 0
                });
            }

            return {
                nodes,
                links
            };
        }
    },
    Mutation: {
        createNote: async (_, { note }: { note: NoteInput }) => {
            const PLACEHOLDER_PREFIX = '{%';
            const PLACEHOLDER_SUFFIX = '%}';

            const replacePlaceholder = async (content: string) => {
                const placeholders = content.matchAll(new RegExp(`${PLACEHOLDER_PREFIX}([^}]+)${PLACEHOLDER_SUFFIX}`, 'g'));
                const $placeholders = await models.placeholder.findMany({
                    select: {
                        template: true,
                        replacement: true
                    },
                    where: { template: { in: Array.from(new Set(Array.from(placeholders, p => p[1]))) } }
                });

                for (const $placeholder of $placeholders) {
                    content = content.replace(new RegExp(`${PLACEHOLDER_PREFIX}${$placeholder.template}${PLACEHOLDER_SUFFIX}`, 'g'), $placeholder.replacement);
                }
                return content;
            };

            const replacedTitle = await replacePlaceholder(note.title);
            const replacedContent = await replacePlaceholder(note.content);

            const $note = await models.note.create({
                data: {
                    title: replacedTitle,
                    content: replacedContent,
                    ...buildNoteSearchProjection({
                        title: replacedTitle,
                        content: replacedContent
                    }),
                    ...(note.layout && { layout: note.layout })
                }
            });
            if (note.content) {
                const blocks = extractBlocksByType<{ id: string }>(
                    'tag',
                    JSON.parse(note.content)
                );

                return await models.note.update({
                    where: { id: $note.id },
                    data: { tags: { set: blocks.map(block => ({ id: Number(block.props.id) })) } }
                });
            }

            return $note;
        },
        updateNote: async (_, {
            id,
            note,
            editSessionId
        }: {
            id: number;
            note: NoteInput;
            editSessionId?: string;
        }, context: {
            req?: Request;
        }) => {
            const userAgentHeader = context.req?.headers['user-agent'];
            const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
            let blocks: BlockNote<{ id: string }>[] = [];
            const existingNote = await models.note.findUnique({
                where: { id: Number(id) },
                select: {
                    title: true,
                    content: true
                }
            });

            if (!existingNote) {
                throw 'NOT FOUND';
            }

            if (note.content) {
                blocks = extractBlocksByType<{ id: string }>(
                    'tag',
                    JSON.parse(note.content)
                );
            }

            await captureNoteBaseline({
                noteId: Number(id),
                ...(editSessionId ? { editSessionId } : {}),
                meta: createSnapshotMetaFromUserAgent(userAgent)
            });

            const nextTitle = note.title ?? existingNote.title;
            const nextContent = note.content ?? existingNote.content;

            const $note = await models.note.update({
                where: { id: Number(id) },
                data: {
                    ...note,
                    ...buildNoteSearchProjection({
                        title: nextTitle,
                        content: nextContent
                    }),
                    ...(note.content ? { tags: { set: blocks.map(block => ({ id: Number(block.props.id) })) } } : {})
                }
            });
            return $note;
        },
        deleteNote: async (_, { id }: Note) => {
            const trashedNote = await trashNoteById(Number(id));

            if (!trashedNote) {
                throw 'NOT FOUND';
            }

            return true;
        },
        restoreNoteSnapshot: async (_, { id }: { id: string }, context: {
            req?: Request;
        }) => {
            const userAgentHeader = context.req?.headers['user-agent'];
            const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
            const note = await restoreNoteSnapshot(Number(id), { meta: createSnapshotMetaFromUserAgent(userAgent) });

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
        pinNote: (_, { id, pinned }: Note) => models.note.update({
            where: { id: Number(id) },
            data: { pinned: Boolean(pinned) }
        }),
        reorderNotes: async (_, { notes }: { notes: Array<{ id: string; order: number }> }) => {
            const updatePromises = notes.map(({ id, order }) =>
                models.note.update({
                    where: { id: Number(id) },
                    data: { order }
                })
            );
            return await Promise.all(updatePromises);
        }
    },
    Note: {
        tags: async (note: Note) => await models.tag.findMany({ where: { notes: { some: { id: note.id } } } }),
        contentAsMarkdown: async (note: Note) => {
            const { blocksToMarkdown } = await import('~/modules/blocknote.js');
            return blocksToMarkdown(note.content);
        }
    }
};
