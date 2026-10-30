import type { IResolvers } from '@graphql-tools/utils';
import type { Tag } from '~/models.js';
import models from '~/models.js';

type TagReferenceCountSource =
    | (Pick<Tag, 'id'> & { referenceCount?: number })
    | {
          id: string;
          referenceCount?: number;
      };

type TagFieldResolvers = NonNullable<IResolvers['Tag']>;

export const tagFieldResolvers: TagFieldResolvers = {
    referenceCount: async (tag: TagReferenceCountSource) => {
        if (tag.referenceCount !== undefined) return tag.referenceCount;
        return models.note.count({ where: { tags: { some: { id: Number(tag.id) } } } });
    },
};
