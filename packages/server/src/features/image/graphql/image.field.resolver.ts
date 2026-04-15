import type { IResolvers } from '@graphql-tools/utils';
import models, { type Image } from '~/models.js';

type ImageFieldResolvers = NonNullable<IResolvers['Image']>;

type CountImageReferences = (url: string) => Promise<number>;

export const createImageReferenceCountFieldResolver = (
    countReferences: CountImageReferences = async (url) => models.note.count({ where: { content: { contains: url } } }),
) => {
    return async (image: Image) => {
        return countReferences(image.url);
    };
};

export const imageFieldResolvers: ImageFieldResolvers = {
    referenceCount: createImageReferenceCountFieldResolver(),
};
