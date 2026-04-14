import type { IResolvers } from '@graphql-tools/utils';
import type { Prisma } from '~/models.js';
import models from '~/models.js';
import type { Pagination, SearchFilter } from '~/types/index.js';

type TagQueryResolvers = NonNullable<IResolvers['Query']>;

export const tagQueryResolvers: TagQueryResolvers = {
    allTags: async (
        _,
        {
            searchFilter,
            pagination,
        }: {
            searchFilter: SearchFilter;
            pagination: Pagination;
        },
    ) => {
        const where: Prisma.TagWhereInput = {
            name: { contains: searchFilter.query },
            NOT: { notes: { none: {} } },
        };
        const tags = models.tag.findMany({
            skip: pagination.offset,
            take: pagination.limit,
            where,
            orderBy: { notes: { _count: 'desc' } },
        });

        return {
            totalCount: await models.tag.count({ where }),
            tags: await tags,
        };
    },
};
