import type { IResolvers } from '@graphql-tools/utils';
import { ensureTagByName } from '~/features/tag/services/organization.js';

export const createTagMutationResolver = (ensureTag = ensureTagByName) => {
    return async (_: unknown, { name }: { name: string }) => {
        const result = await ensureTag(name);

        return result.tag;
    };
};

type TagMutationResolvers = NonNullable<IResolvers['Mutation']>;

export const tagMutationResolvers: TagMutationResolvers = {
    createTag: createTagMutationResolver(),
};
