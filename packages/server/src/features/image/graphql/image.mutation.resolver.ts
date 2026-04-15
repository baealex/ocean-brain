import type { IResolvers } from '@graphql-tools/utils';
import { deleteImageById } from '../services/delete.js';

type ImageMutationResolvers = NonNullable<IResolvers['Mutation']>;

type DeleteImage = (id: number) => Promise<boolean>;

export const createDeleteImageMutationResolver = (deleteImage: DeleteImage = deleteImageById) => {
    return async (_: unknown, { id }: { id: string | number }) => {
        try {
            return await deleteImage(Number(id));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[image] Delete failed: ${message}\n`);
            return false;
        }
    };
};

export const imageMutationResolvers: ImageMutationResolvers = {
    deleteImage: createDeleteImageMutationResolver(),
};
