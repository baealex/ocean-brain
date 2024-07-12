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
            const keywords = searchFilter.query.split(' ').map(word => `%${word}%`);

            const $notes = models.note.findMany({
                orderBy: [
                    { pinned: 'desc' },
                    { updatedAt: 'desc' }
                ],
                where: {
                    AND: keywords.map(keyword => ({
                        OR: [
                            { title: { contains: keyword } },
                            { content: { contains: keyword } }
                        ]
                    }))
                },
                take: Number(pagination.limit),
                skip: Number(pagination.offset)
            });
            return {
                totalCount: models.note.count({
                    where: {
                        AND: keywords.map(keyword => ({
                            OR: [
                                { title: { contains: keyword } },
                                { content: { contains: keyword } }
                            ]
                        }))
                    }
                }),
                notes: $notes
            };
        },
        tagNotes: async (_, {
            searchFilter,
            pagination
        }: {
            searchFilter: SearchFilter;
            pagination: Pagination;
        }) => {
            const $notes = models.note.findMany({
                orderBy: { updatedAt: 'desc' },
                where: { tags: { some: { id: Number(searchFilter.query) } } },
                take: Number(pagination.limit),
                skip: Number(pagination.offset)
            });
            return {
                totalCount: models.note.count({ where: { tags: { some: { id: Number(searchFilter.query) } } } }),
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
            return models.note.create({
                data: {
                    title,
                    content
                }
            });
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
