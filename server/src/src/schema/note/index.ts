import type { IResolvers } from '@graphql-tools/utils';

import models from '~/models';
import { gql } from '~/modules/graphql';

import type { Note, Tag } from '~/models';
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
                orderBy: { updatedAt: 'desc' },
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
        note: (_, { id }: Note) => models.note.findUnique({ where: { id: Number(id) } })
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
                const tagNames = decodeURIComponent(content).match(/"tag":"@([a-zA-Z0-9_가-힣]+")/g);

                const tags: Tag[] = [];

                for (const tagName of new Set(tagNames || [])) {
                    const [name] = tagName.match(/@([a-zA-Z0-9_가-힣]+)/);
                    if (!name) continue;
                    const $tag = await models.tag.findFirst({ where: { name } });
                    tags.push($tag);
                }

                return await models.note.update({
                    where: { id: $note.id },
                    data: { tags: { set: tags } }
                });
            }

            return $note;
        },
        updateNote: async (_, { id, title, content }: Note) => {
            const tagNames = decodeURIComponent(content).match(/"tag":"@([a-zA-Z0-9_가-힣]+")/g);

            const tags: Tag[] = [];

            for (const tagName of new Set(tagNames || [])) {
                const [name] = tagName.match(/@([a-zA-Z0-9_가-힣]+)/);
                if (!name) continue;
                const $tag = await models.tag.findFirst({ where: { name } });
                tags.push($tag);
            }

            const $note = await models.note.update({
                where: { id: Number(id) },
                data: {
                    title,
                    content: decodeURIComponent(content),
                    tags: { set: tags }
                }
            });
            return $note;
        },
        deleteNote: (_, { id }: Note) => models.note.delete({ where: { id: Number(id) } }).then(() => true),
        pinNote: (_, { id, pinned }: Note) => models.note.update({
            where: { id: Number(id) },
            data: { pinned: Boolean(pinned) }
        })
    },
    Note: { tags: async (note: Note) => await models.tag.findMany({ where: { notes: { some: { id: note.id } } } }) }
};
