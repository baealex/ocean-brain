import type { IResolvers } from '@graphql-tools/utils';

import models from '~/models.js';
import { gql } from '~/modules/graphql.js';

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
        notesInDateRange(dateRange: DateRangeInput): [Note!]!
        pinnedNotes: [Note!]!
        imageNotes(src: String!): [Note!]!
        backReferences(id: ID!): [Note]!
        note(id: ID!): Note!
        noteGraph: NoteGraph!
    }
`;

export const noteMutation = gql`
    type Mutation {
        createNote(note: NoteInput!): Note!
        updateNote(id: ID!, note: NoteInput!): Note!
        deleteNote(id: ID!): Boolean!
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

export const noteResolvers: IResolvers = {
    Query: {
        allNotes: async (_, {
            searchFilter,
            pagination
        }: {
            searchFilter: SearchFilter;
            pagination: Pagination;
        }) => {
            const queryItems = searchFilter.query.split(' ');
            const included = queryItems
                .filter((item: string) => !item.startsWith('-'))
                .map((word: string) => `%${word}%`);
            const excluded = queryItems
                .filter((item: string) => item.startsWith('-'))
                .map((item: string) => item.slice(1))
                .map((word: string) => `%${word}%`);

            const where: Prisma.NoteWhereInput = {
                AND: [
                    ...included.map((keyword: string) => ({
                        OR: [
                            { title: { contains: keyword } },
                            { content: { contains: keyword } }
                        ]
                    })),
                    ...excluded.map((keyword: string) => ({
                        NOT: {
                            OR: [
                                { title: { contains: keyword } },
                                { content: { contains: keyword } }
                            ]
                        }
                    }))
                ]
            };

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

            const $notes = models.note.findMany({
                orderBy,
                where,
                take: Number(pagination.limit),
                skip: Number(pagination.offset)
            });
            return {
                totalCount: models.note.count({ where }),
                notes: $notes
            };
        },
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
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            }
            return $note;
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
        updateNote: async (_, { id, note }: { id: number; note: NoteInput }) => {
            let blocks: BlockNote<{ id: string }>[] = [];

            if (note.content) {
                blocks = extractBlocksByType<{ id: string }>(
                    'tag',
                    JSON.parse(note.content)
                );
            }

            const $note = await models.note.update({
                where: { id: Number(id) },
                data: {
                    ...note,
                    ...(note.content ? { tags: { set: blocks.map(block => ({ id: Number(block.props.id) })) } } : {})
                }
            });
            return $note;
        },
        deleteNote: async (_, { id }: Note) => {
            await models.tag.deleteMany({ where: { notes: { none: {} } } });
            await models.note.delete({ where: { id: Number(id) } });
            return true;
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
