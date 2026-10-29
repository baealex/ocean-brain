import type { IResolvers } from '@graphql-tools/utils';
import { resolvedWorkspaceScope, resolveWorkspaceWhere, type WorkspaceScopeInput } from '~/features/workspace/scope.js';
import type { Prisma } from '~/models.js';
import models from '~/models.js';
import type { Pagination, SearchFilter } from '~/types/index.js';
import { normalizeTagName } from '../services/organization.js';

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

export const tagQueryResolvers = {
    tagsByNames: async (_, { names }: { names: string[] }) => {
        if (names.length > 100) {
            throw new Error('At most 100 tag names may be resolved at once.');
        }
        return models.tag.findMany({
            where: { name: { in: [...new Set(names.map(normalizeTagName))] } },
            orderBy: { name: 'asc' },
        });
    },
    allTags: async (
        _,
        {
            scope,
            searchFilter,
            pagination,
        }: {
            scope?: WorkspaceScopeInput;
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
        const noteWhere = await resolveWorkspaceWhere(scope);
        if (noteWhere.workspaceId !== undefined) {
            const matched = await models.tag.findMany({
                where: { name: { contains: searchFilter.query }, notes: { some: noteWhere } },
                include: { _count: { select: { notes: { where: noteWhere } } } },
            });
            const rows = matched.map((tag) => ({ ...tag, referenceCount: tag._count.notes }));
            rows.sort((a, b) => {
                const comparison =
                    sortBy === 'referenceCount' ? a.referenceCount - b.referenceCount : a.name.localeCompare(b.name);
                return (sortOrder === 'asc' ? comparison : -comparison) || a.id - b.id;
            });
            return {
                resolvedScope: resolvedWorkspaceScope(noteWhere),
                totalCount: rows.length,
                tags: rows.slice(pagination.offset, pagination.offset + pagination.limit),
            };
        }

        const tags = models.tag.findMany({
            skip: pagination.offset,
            take: pagination.limit,
            where,
            orderBy: getTagOrderBy(sortBy, sortOrder),
        });

        return {
            resolvedScope: resolvedWorkspaceScope(noteWhere),
            totalCount: await models.tag.count({ where }),
            tags: await tags,
        };
    },
} satisfies TagQueryResolvers;
