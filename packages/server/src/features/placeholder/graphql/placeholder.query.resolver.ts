import type { IResolvers } from '@graphql-tools/utils';
import models from '~/models.js';
import type { Pagination, SearchFilter } from '~/types/index.js';

type PlaceholderQueryResolvers = NonNullable<IResolvers['Query']>;

interface PlaceholderQueryDeps {
    countPlaceholders: () => Promise<number>;
    findPlaceholderById: (id: number) => Promise<unknown>;
    findPlaceholders: (input: {
        where?: { name: { contains: string } };
        take?: number;
        skip?: number;
    }) => Promise<unknown[]>;
}

export const createAllPlaceholdersQueryResolver = (
    deps: PlaceholderQueryDeps = {
        countPlaceholders: async () => models.placeholder.count(),
        findPlaceholderById: async (id) => models.placeholder.findFirst({ where: { id } }),
        findPlaceholders: async (input) => models.placeholder.findMany(input),
    },
) => {
    return async (
        _: unknown,
        { searchFilter, pagination }: { searchFilter?: SearchFilter; pagination?: Pagination },
    ) => {
        const placeholders = await deps.findPlaceholders({
            where: searchFilter?.query ? { name: { contains: searchFilter.query } } : undefined,
            take: pagination?.limit,
            skip: pagination?.offset,
        });

        const totalCount = await deps.countPlaceholders();

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
