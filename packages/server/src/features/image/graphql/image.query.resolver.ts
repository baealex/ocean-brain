import type { IResolvers } from '@graphql-tools/utils';
import models from '~/models.js';
import type { Pagination } from '~/types/index.js';

type ImageQueryResolvers = NonNullable<IResolvers['Query']>;

interface ImageQueryDeps {
    countImages: () => Promise<number>;
    findImageById: (id: number) => Promise<unknown>;
    findImages: (input: { orderBy: { createdAt: 'desc' }; skip: number; take: number }) => Promise<unknown[]>;
}

export const createAllImagesQueryResolver = (
    deps: ImageQueryDeps = {
        countImages: async () => models.image.count(),
        findImageById: async (id) => models.image.findFirst({ where: { id } }),
        findImages: async (input) => models.image.findMany(input),
    },
) => {
    return async (
        _: unknown,
        {
            pagination,
        }: {
            pagination: Pagination;
        },
    ) => {
        const [totalCount, images] = await Promise.all([
            deps.countImages(),
            deps.findImages({
                skip: pagination.offset,
                take: pagination.limit,
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        return {
            totalCount,
            images,
        };
    };
};

export const createImageQueryResolver = (
    deps: Pick<ImageQueryDeps, 'findImageById'> = {
        findImageById: async (id) => models.image.findFirst({ where: { id } }),
    },
) => {
    return async (_: unknown, { id }: { id: string | number }) => {
        return deps.findImageById(Number(id));
    };
};

export const imageQueryResolvers: ImageQueryResolvers = {
    allImages: createAllImagesQueryResolver(),
    image: createImageQueryResolver(),
};
