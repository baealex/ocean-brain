import type { IResolvers } from '@graphql-tools/utils';
import type { Prisma } from '~/models.js';
import models from '~/models.js';
import type { Pagination, SearchFilter } from '~/types/index.js';

type TagQueryResolvers = NonNullable<IResolvers['Query']>;
type TagSortBy = 'referenceCount' | 'name';
type TagSortOrder = 'asc' | 'desc';

const TAG_SORT_FIELDS = new Set<TagSortBy>(['referenceCount', 'name']);

const normalizeSortBy = (sortBy?: string): TagSortBy => {
    return TAG_SORT_FIELDS.has(sortBy as TagSortBy) ? (sortBy as TagSortBy) : 'referenceCount';
};

const normalizeSortOrder = (sortOrder?: string): TagSortOrder => {
    return sortOrder === 'asc' ? 'asc' : 'desc';
};

const getTagOrderBy = (sortBy: TagSortBy, sortOrder: TagSortOrder): Prisma.TagOrderByWithRelationInput => {
    if (sortBy === 'referenceCount') {
        return { notes: { _count: sortOrder } };
    }

    return { [sortBy]: sortOrder };
};

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
        const sortBy = normalizeSortBy(searchFilter.sortBy);
        const sortOrder = normalizeSortOrder(searchFilter.sortOrder);
        const tags = models.tag.findMany({
            skip: pagination.offset,
            take: pagination.limit,
            where,
            orderBy: getTagOrderBy(sortBy, sortOrder),
        });

        return {
            totalCount: await models.tag.count({ where }),
            tags: await tags,
        };
    },
};
