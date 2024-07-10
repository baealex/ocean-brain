import type { IResolvers } from '@graphql-tools/utils';
import fs from 'fs';
import path from 'path';

import models, { type Image } from '~/models';
import { gql } from '~/modules/graphql';

export const imageType = gql`
    type Image {
        id: ID!
        url: String!
        referenceCount: Int!
    }
`;

export const imageQuery = gql`
    type Query {
        allImages(offset: Int=0, limit: Int=20): [Image!]!
        image(id: ID!): Image!
    }
`;

export const imageMutation = gql`
    type Mutation {
        deleteImage(id: ID!): Boolean!
    }
`;

export const imageTypeDefs = `
    ${imageType}
    ${imageQuery}
    ${imageMutation}
`;

export const imageResolvers: IResolvers = {
    Query: {
        allImages: async (_, { offset = 0, limit = 20 }) => {
            return models.image.findMany({
                skip: offset,
                take: limit,
                orderBy: { createdAt: 'desc' }
            });
        },
        image: async (_, { id }) => {
            return models.image.findFirst({ where: { id: Number(id) } });
        }
    },
    Mutation: {
        deleteImage: async (_, { id }) => {
            try {
                const $image = await models.image.findFirst({ where: { id: Number(id) } });

                fs.unlinkSync(path.resolve('./public', $image.url.slice(1)));

                await models.image.delete({ where: { id: Number(id) } });

                return true;
            } catch (error) {
                console.log(error);
                return false;
            }
        }
    },
    Image: {
        referenceCount: async (image: Image) => {
            return models.note.count({ where: { content: { contains: image.url } } });
        }
    }
};
