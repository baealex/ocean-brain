import type { IResolvers } from '@graphql-tools/utils';

import models, { type Cache } from '~/models.js';
import { createAppError } from '~/modules/error-handler.js';
import { NAVIGATION_SETTINGS_KEY } from '../../navigation/service.js';

const requireEditableCacheKey = (key: string) => {
    if (key === NAVIGATION_SETTINGS_KEY) {
        throw createAppError(400, 'RESERVED_SETTINGS_KEY', 'Use menu settings to change the navigation layout.');
    }
};

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
        requireEditableCacheKey(key);
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
        requireEditableCacheKey(key);
        await service.deleteCache(key);
        return true;
    };
};

export const cacheMutationResolvers: NonNullable<IResolvers['Mutation']> = {
    setCache: createSetCacheMutationResolver(),
    deleteCache: createDeleteCacheMutationResolver(),
};
