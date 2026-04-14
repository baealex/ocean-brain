import type { IResolvers } from '@graphql-tools/utils';
import type { Tag } from '~/models.js';
import models from '~/models.js';

type TagReferenceCountSource =
    | Pick<Tag, 'id'>
    | {
          id: string;
      };

type TagFieldResolvers = NonNullable<IResolvers['Tag']>;

export const tagFieldResolvers: TagFieldResolvers = {
    referenceCount: async (tag: TagReferenceCountSource) => {
        return models.note.count({ where: { tags: { some: { id: Number(tag.id) } } } });
    },
};
