import type { IResolvers } from '@graphql-tools/utils';
import models from '~/models.js';
import type { Pagination, SearchFilter } from '~/types/index.js';

type PlaceholderQueryResolvers = NonNullable<IResolvers['Query']>;
type PlaceholderWhere = { name: { contains: string } };

interface PlaceholderQueryDeps {
    countPlaceholders: (where?: PlaceholderWhere) => Promise<number>;
    findPlaceholderById: (id: number) => Promise<unknown>;
    findPlaceholders: (input: { where?: PlaceholderWhere; take?: number; skip?: number }) => Promise<unknown[]>;
}

export const createAllPlaceholdersQueryResolver = (
    deps: PlaceholderQueryDeps = {
        countPlaceholders: async (where) => models.placeholder.count({ where }),
        findPlaceholderById: async (id) => models.placeholder.findFirst({ where: { id } }),
        findPlaceholders: async (input) => models.placeholder.findMany(input),
    },
) => {
    return async (
        _: unknown,
        { searchFilter, pagination }: { searchFilter?: SearchFilter; pagination?: Pagination },
    ) => {
        const where = searchFilter?.query ? { name: { contains: searchFilter.query } } : undefined;
        const placeholders = await deps.findPlaceholders({
            where,
            take: pagination?.limit,
            skip: pagination?.offset,
        });

        const totalCount = await deps.countPlaceholders(where);

        return {
            totalCount,
            placeholders,
        };
    };
};

export const createPlaceholderQueryResolver = (
    deps: Pick<PlaceholderQueryDeps, 'findPlaceholderById'> = {
        findPlaceholderById: async (id) => models.placeholder.findFirst({ where: { id } }),
    },
) => {
    return async (_: unknown, { id }: { id: string | number }) => {
        return deps.findPlaceholderById(Number(id));
    };
};

export const placeholderQueryResolvers: PlaceholderQueryResolvers = {
    allPlaceholders: createAllPlaceholdersQueryResolver(),
    placeholder: createPlaceholderQueryResolver(),
};
