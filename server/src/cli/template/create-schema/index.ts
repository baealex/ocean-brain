import type { IResolvers } from '@graphql-tools/utils';

import models, { type __NAME__UPPER__ } from '~/models';
import { gql } from '~/modules/graphql';

export const __NAME__Type = gql`
    type __NAME__UPPER__ {
        id: ID!
    }
`;

export const __NAME__Query = gql`
    type Query {
        all__NAME__UPPER__s: [__NAME__UPPER__!]!
        __NAME__(id: ID!): __NAME__UPPER__!
    }
`;

export const __NAME__Mutation = gql`
    type Mutation {
        create__NAME__UPPER__(): __NAME__UPPER__!
        delete__NAME__UPPER__(id: ID!): Boolean!
    }
`;

export const __NAME__TypeDefs = `
    ${__NAME__Type}
    ${__NAME__Query}
    ${__NAME__Mutation}
`;

export const __NAME__Resolvers: IResolvers = {
    Query: {
        all__NAME__UPPER__s: models.__NAME__.findMany,
        __NAME__: (_, { id }: __NAME__UPPER__) => models.__NAME__.findUnique({
            where: {
                id: Number(id),
            },
        }),
    },
    Mutation: {
        create__NAME__UPPER__: async (_, { }: __NAME__UPPER__) => {
            return models.__NAME__.create({
                data: {

                },
            });
        },
        delete__NAME__UPPER__: (_, { id }: __NAME__UPPER__) => models.__NAME__.delete({
            where: {
                id: Number(id),
            },
        }).then(() => true)
    },
};
