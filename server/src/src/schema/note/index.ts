import type { IResolvers } from '@graphql-tools/utils';

import models from '~/models';
import { gql } from '~/modules/graphql';

import type { Note } from '~/models';
import type { Pagination, SearchFilter } from '~/types';

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
        createNote(title: String = "", content: String = ""): Note!
        updateNote(id: ID!, title: String!, content: String!): Note!
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
}

const extractBlocks = <T>(type: string, content: string) => {
    const items: BlockNote<T>[] = JSON.parse(decodeURIComponent(content));
    return items.reduce<typeof items>((acc, cur) => {
        if (cur.content) {
            return acc.concat(cur.content.filter(item => item.type === type));
        }
        return acc;
    }, []);
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
                .filter(item => !item.startsWith('-'))
                .map(word => `%${word}%`);
            const excluded = queryItems
                .filter(item => item.startsWith('-'))
                .map(item => item.slice(1))
                .map(word => `%${word}%`);

            const where: Parameters<typeof models.note.findMany>[0]['where']  = {
                AND: [
                    ...included.map(keyword => ({
                        OR: [
                            { title: { contains: keyword } },
                            { content: { contains: keyword } }
                        ]
                    })),
                    ...excluded.map(keyword => ({
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
            const where: Parameters<typeof models.note.findMany>[0]['where'] = {
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
            const where: Parameters<typeof models.note.findMany>[0]['where'] =
                { tags: { some: { id: Number(searchFilter.query) } } };

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
            const blocks = extractBlocks<{
                id: string;
                title: string;
            }>('reference', $note.content);
            if (blocks.length > 0) {
                const referenceIds = blocks.map(block => Number(block.props.id));
                const $references = await models.note.findMany({ where: { id: { in: referenceIds } } });
                const content = $references.reduce<string>((acc, $reference) => {
                    const reference = blocks.find(block => Number(block.props.id) === $reference.id);
                    if (reference.props.title !== $reference.title) {
                        return acc.replace(
                            `reference","props":{"id":"${reference.props.id}","title":"${reference.props.title}"`,
                            `reference","props":{"id":"${$reference.id}","title":"${$reference.title}"`,
                        );
                    }
                    return acc;
                }, $note.content);
                if (content !== $note.content) {
                    return await models.note.update({
                        where: { id: $note.id },
                        data: { content }
                    });
                }
            }
            return $note;
        }
    },
    Mutation: {
        createNote: async (_, { title, content }: Note) => {
            const $note = await models.note.create({
                data: {
                    title,
                    content: decodeURIComponent(content)
                }
            });
            if (content) {
                const blocks = extractBlocks<{ id: string }>('tag', content);

                return await models.note.update({
                    where: { id: $note.id },
                    data: { tags: { set: blocks.map(block => ({ id: Number(block.props.id) })) } }
                });
            }

            return $note;
        },
        updateNote: async (_, { id, title, content }: Note) => {
            const blocks = extractBlocks<{ id: string }>('tag', content);

            const $note = await models.note.update({
                where: { id: Number(id) },
                data: {
                    title,
                    content: decodeURIComponent(content),
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
