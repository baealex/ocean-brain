import { type IResolvers } from '@graphql-tools/utils';

import models, { type User } from '~/models';
import { gql } from '~/modules/graphql';
import { createPasswordHash } from '~/modules/auth';

export const userType = gql`
    type User {
        id: ID!
        name: String
        email: String!
        createdAt: String!
        updatedAt: String!
    }
`;

export const userQuery = gql`
    type Query {
        allUsers: [User!]!
        user(id: ID!): User!
    }
`;

export const userMutation = gql`
    type Mutation {
        createUser(name: String!, email: String!, password: String!): User!
        updateUser(id: ID!, name: String, email: String, password: String): User!
        deleteUser(id: ID!): Boolean!
    }
`;

export const userTypeDefs = `
    ${userType}
    ${userQuery}
    ${userMutation}
`;

export const userResolvers: IResolvers = {
    Query: {
        allUsers: models.user.findMany,
        user: (_, { id }: User) => models.user.findUnique({ where: { id: Number(id) } })
    },
    Mutation: {
        createUser: async (_, { name, email, password }: User) => {
            if (await models.user.findUnique({ where: { email } })) {
                throw new Error('Email already exists');
            }

            return models.user.create({
                data: {
                    name,
                    email,
                    password: await createPasswordHash(password)
                }
            });
        },
        updateUser: async (_, { id, name, email, password }: User) => models.user.update({
            where: { id: Number(id) },
            data: {
                name,
                email,
                password: password ? await createPasswordHash(password) : undefined
            }
        }),
        deleteUser: (_, { id }: User) => models.user.delete({ where: { id: Number(id) } }).then(() => true)
    }
};
