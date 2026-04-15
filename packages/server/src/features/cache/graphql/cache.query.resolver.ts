import type { IResolvers } from '@graphql-tools/utils';

import models, { type Cache } from '~/models.js';

type CacheRecord = Pick<Cache, 'id' | 'key' | 'value'>;

type CacheQueryService = {
    findCaches: () => Promise<CacheRecord[]>;
    findCacheByKey: (key: string) => Promise<CacheRecord | null>;
};

const createCacheQueryService = (): CacheQueryService => ({
    findCaches: () => models.cache.findMany(),
    findCacheByKey: (key) => models.cache.findUnique({ where: { key } }),
});

export const createAllCachesQueryResolver = (service: CacheQueryService = createCacheQueryService()) => {
    return async () => service.findCaches();
};

export const createCacheQueryResolver = (service: CacheQueryService = createCacheQueryService()) => {
    return async (_: unknown, { key }: { key: string }) => service.findCacheByKey(key);
};

export const cacheQueryResolvers: NonNullable<IResolvers['Query']> = {
    allCaches: createAllCachesQueryResolver(),
    cache: createCacheQueryResolver(),
};
