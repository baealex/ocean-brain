import type { IResolvers } from '@graphql-tools/utils';

import type { Note, Tag } from '~/models';
import models from '~/models';
import { gql } from '~/modules/graphql';

export const noteType = gql`
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
`;

export const noteQuery = gql`
    type Query {
        allNotes(query: String = "", limit: Int = 10, offset: Int = 0): [Note!]!
        pinnedNotes: [Note!]!
        tagNotes(id: ID!): [Note!]!
        imageNotes(src: String!): [Note!]!
        backReferences(id: ID!): [Note]!
        note(id: ID!): Note!
        totalNotes: Int!
        totalTagNotes(id: ID!): Int!
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
        allNotes: async (_, { query = '', limit = 10, offset = 0 }) => {
            const keywords = query.split(' ').map(word => `%${word}%`);

            return models.note.findMany({
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
                take: Number(limit),
                skip: Number(offset)
            });
        },
        pinnedNotes: async () => models.note.findMany({
            orderBy: { updatedAt: 'desc' },
            where: { pinned: true }
        }),
        tagNotes: async (_, { id }) => models.note.findMany({
            orderBy: { updatedAt: 'desc' },
            where: { tags: { some: { id: Number(id) } } }
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
        note: (_, { id }: Note) => models.note.findUnique({ where: { id: Number(id) } }),
        totalNotes: async () => models.note.count(),
        totalTagNotes: async (_, { id }) => models.note.count({ where: { tags: { some: { id: Number(id) } } } })
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
