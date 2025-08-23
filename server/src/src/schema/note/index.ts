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
    }

    input DateRangeInput {
        start: String!
        end: String!
    }

    input NoteInput {
        title: String
        content: String
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
        createdAt: String!
        updatedAt: String!
        pinned: Boolean!
        tags: [Tag!]!
    }

    type Notes {
        totalCount: Int!
        notes: [Note!]!
    }
`;

export const noteQuery = gql`
    type Query {
        allNotes(searchFilter: SearchFilterInput, pagination: PaginationInput): Notes!
        tagNotes(searchFilter: SearchFilterInput, pagination: PaginationInput): Notes!
        notesInDateRange(dateRange: DateRangeInput): [Note!]!
        pinnedNotes: [Note!]!
        imageNotes(src: String!): [Note!]!
        backReferences(id: ID!): [Note]!
        note(id: ID!): Note!
    }
`;

export const noteMutation = gql`
    type Mutation {
        createNote(note: NoteInput!): Note!
        updateNote(id: ID!, note: NoteInput!): Note!
        deleteNote(id: ID!): Boolean!
        pinNote(id: ID!, pinned: Boolean!): Note!
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

            const $notes = models.note.findMany({
                orderBy: [
                    { pinned: 'desc' },
                    { updatedAt: 'desc' }
                ],
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
            orderBy: { pinned: 'desc' },
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
                    content: replacedContent
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
            const blocks = extractBlocksByType<{ id: string }>(
                'tag',
                JSON.parse(note.content)
            );

            const $note = await models.note.update({
                where: { id: Number(id) },
                data: {
                    ...note,
                    tags: { set: blocks.map(block => ({ id: Number(block.props.id) })) }
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
        })
    },
    Note: { tags: async (note: Note) => await models.tag.findMany({ where: { notes: { some: { id: note.id } } } }) }
};
