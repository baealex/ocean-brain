import type { IResolvers } from '@graphql-tools/utils';

import models, { type Cache } from '~/models.js';

type CacheRecord = Pick<Cache, 'id' | 'key' | 'value'>;
type CacheMutationInput = Pick<Cache, 'key' | 'value'>;

type CacheMutationService = {
    findCacheByKey: (key: string) => Promise<CacheRecord | null>;
    createCache: (input: CacheMutationInput) => Promise<CacheRecord>;
    updateCache: (input: CacheMutationInput) => Promise<CacheRecord>;
    deleteCache: (key: string) => Promise<void>;
};

const createCacheMutationService = (): CacheMutationService => ({
    findCacheByKey: (key) => models.cache.findFirst({ where: { key } }),
    createCache: ({ key, value }) =>
        models.cache.create({
            data: {
                key,
                value,
            },
        }),
    updateCache: ({ key, value }) =>
        models.cache.update({
            where: { key },
            data: { value },
        }),
    deleteCache: async (key) => {
        await models.cache.delete({ where: { key } });
    },
});

export const createSetCacheMutationResolver = (service: CacheMutationService = createCacheMutationService()) => {
    return async (_: unknown, { key, value }: CacheMutationInput) => {
        const decodedValue = decodeURIComponent(value);
        const existingCache = await service.findCacheByKey(key);

        if (existingCache) {
            return service.updateCache({
                key,
                value: decodedValue,
            });
        }

        return service.createCache({
            key,
            value: decodedValue,
        });
    };
};

export const createDeleteCacheMutationResolver = (service: CacheMutationService = createCacheMutationService()) => {
    return async (_: unknown, { key }: Pick<Cache, 'key'>) => {
        await service.deleteCache(key);
        return true;
    };
};

export const cacheMutationResolvers: NonNullable<IResolvers['Mutation']> = {
    setCache: createSetCacheMutationResolver(),
    deleteCache: createDeleteCacheMutationResolver(),
};
