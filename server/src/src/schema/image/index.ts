import type { IResolvers } from '@graphql-tools/utils';
import fs from 'fs';
import path from 'path';

import models, { type Image } from '~/models.js';
import { gql } from '~/modules/graphql.js';
import type { Pagination } from '~/types/index.js';

export const imageType = gql`
    input PaginationInput {
        limit: Int!
        offset: Int!
    }

    type Image {
        id: ID!
        url: String!
        referenceCount: Int!
    }

    type Images {
        totalCount: Int!
        images: [Image!]!
    }
`;

export const imageQuery = gql`
    type Query {
        allImages(pagination: PaginationInput): Images!
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
        allImages: async (_, { pagination }: {
            pagination: Pagination;
        }) => {
            const $images = models.image.findMany({
                skip: pagination.offset,
                take: pagination.limit,
                orderBy: { createdAt: 'desc' }
            });
            return {
                totalCount: models.image.count(),
                images: $images
            };
        },
        image: async (_, { id }) => {
            return models.image.findFirst({ where: { id: Number(id) } });
        }
    },
    Mutation: {
        deleteImage: async (_, { id }) => {
            try {
                const $image = await models.image.findFirst({ where: { id: Number(id) } });

                if (!$image) {
                    return false;
                }

                if (fs.existsSync(path.resolve('./public', $image.url.slice(1)))) {
                    fs.unlinkSync(path.resolve('./public', $image.url.slice(1)));
                }

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
